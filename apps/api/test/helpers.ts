import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contract } from '../src/contract.ts';
import { createPool } from '../src/db.ts';
import { migrate } from '../src/migrate.ts';

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Integration tests need DATABASE_URL pointing at a disposable PostgreSQL database');
  return url;
}

export type TestDb = { schema: string; pool: pg.Pool; drop: () => Promise<void> };

export async function createTestDb({ migrated = true } = {}): Promise<TestDb> {
  const url = databaseUrl();
  const schema = `test_${randomBytes(6).toString('hex')}`;
  const admin = createPool({ databaseUrl: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  try {
    if (migrated) await migrate({ databaseUrl: url, direction: 'up', schema });
  } catch (error) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    throw error;
  }
  const pool = createPool({ databaseUrl: url, schema });
  return {
    schema,
    pool,
    drop: async () => {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  };
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema({ ...contract, $id: 'openapi' });

const pointer = (...segments: string[]) => segments.map((s) => s.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');

export function assertMatchesContract(method: string, path: string, status: number, body: unknown) {
  const ref = `openapi#/${pointer('paths', path, method, 'responses', String(status), 'content', 'application/json', 'schema')}`;
  const validate = ajv.getSchema(ref);
  if (!validate) throw new Error(`No contract schema for ${method.toUpperCase()} ${path} ${status}`);
  if (!validate(body)) throw new Error(`Response violates contract ${ref}: ${ajv.errorsText(validate.errors)}`);
}

export async function createAppRolePool(db: TestDb): Promise<{ pool: pg.Pool; drop: () => Promise<void> }> {
  const role = `tazumo_api_test_${randomBytes(4).toString('hex')}`;
  const password = randomBytes(16).toString('hex');
  await db.pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' IN ROLE tazumo_api`);
  const url = new URL(databaseUrl());
  url.username = role;
  url.password = password;
  const pool = createPool({ databaseUrl: url.toString(), schema: db.schema });
  return {
    pool,
    drop: async () => {
      try {
        await pool.end();
      } finally {
        await db.pool.query(`DROP ROLE IF EXISTS ${role}`);
      }
    }
  };
}
