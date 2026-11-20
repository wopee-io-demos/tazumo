import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, databaseUrl } from './helpers.ts';
import { migrate } from '../src/migrate.ts';

const tables = async (db: Awaited<ReturnType<typeof createTestDb>>) =>
  (
    await db.pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name <> 'schema_migrations' ORDER BY 1`,
      [db.schema]
    )
  ).rows.map((r) => r.table_name);

test('migrations create the catalogue schema, are idempotent and reversible', async () => {
  const db = await createTestDb();
  try {
    assert.deepEqual(await tables(db), ['audit_events', 'catalogue_categories', 'markets', 'merchants', 'products', 'user_roles', 'users']);
    assert.equal((await migrate({ databaseUrl: databaseUrl(), direction: 'up', schema: db.schema })).length, 0);
    await migrate({ databaseUrl: databaseUrl(), direction: 'down', count: Infinity, schema: db.schema });
    assert.deepEqual(await tables(db), []);
    await migrate({ databaseUrl: databaseUrl(), direction: 'up', schema: db.schema });
    assert.equal((await tables(db)).length, 7);
  } finally {
    await db.drop();
  }
});

test('database rejects invalid money and identifiers', async () => {
  const db = await createTestDb();
  try {
    await db.pool.query(`INSERT INTO markets VALUES ('m1', 'CZ', 'CZK', 'cs-CZ')`);
    await db.pool.query(`INSERT INTO catalogue_categories VALUES ('food', 'Food', 0)`);
    await db.pool.query(`INSERT INTO merchants (id, slug, market_code, name) VALUES ('00000000-0000-4000-8000-000000000001', 'm', 'm1', 'M')`);
    const product = (price: number, currency: string) =>
      db.pool.query(
        `INSERT INTO products (id, slug, merchant_id, category_code, name, price_minor, currency)
         VALUES (gen_random_uuid(), 'p' || floor(random() * 1e9)::text, '00000000-0000-4000-8000-000000000001', 'food', 'P', $1, $2)`,
        [price, currency]
      );
    await product(1190, 'CZK');
    await assert.rejects(product(-1, 'CZK'), /check constraint/);
    await assert.rejects(product(10.5, 'CZK'), /invalid input syntax for type integer/);
    await assert.rejects(product(100, 'czk'), /check constraint/);
    await assert.rejects(product(100, 'EURO'), /too long|check constraint/);
    await assert.rejects(db.pool.query(`INSERT INTO markets VALUES ('Bad Code', 'CZ', 'CZK', 'cs-CZ')`), /check constraint/);
    await assert.rejects(
      db.pool.query(`INSERT INTO merchants (id, slug, market_code, name) VALUES (gen_random_uuid(), 'x', 'missing', 'X')`),
      /foreign key/
    );
  } finally {
    await db.drop();
  }
});

test('migration 0003 refuses an existing tazumo_api role with unsafe attributes or memberships', async () => {
  const db = await createTestDb();
  const fresh = await createTestDb({ migrated: false });
  try {
    await db.pool.query('ALTER ROLE tazumo_api LOGIN');
    await assert.rejects(migrate({ databaseUrl: databaseUrl(), direction: 'up', schema: fresh.schema }), /unsafe attributes/);
    await db.pool.query('ALTER ROLE tazumo_api NOLOGIN');
    await db.pool.query('GRANT pg_read_all_data TO tazumo_api');
    await assert.rejects(migrate({ databaseUrl: databaseUrl(), direction: 'up', schema: fresh.schema }), /unsafe attributes/);
  } finally {
    await db.pool.query('ALTER ROLE tazumo_api NOLOGIN');
    await db.pool.query('REVOKE pg_read_all_data FROM tazumo_api');
    await fresh.drop();
    await db.drop();
  }
});
