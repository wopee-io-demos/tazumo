import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { uuidV5 } from '../src/fixtures.ts';
import { seed } from '../src/seed.ts';
import { assertMatchesContract, createTestDb, databaseUrl, type TestDb } from './helpers.ts';
import { audience, issuer, mint, signingKey, startIdp, type SigningKey, type TestIdp } from './idp.ts';

const merchantA = uuidV5('merchant:Piazza Local');
const rolePath = '/v1/admin/users/{userId}/roles/{role}';

describe('admin role grants, running as the least-privilege tazumo_api role', () => {
  let db: TestDb;
  let idp: TestIdp;
  let key: SigningKey;
  let appRole: string;
  let appPool: pg.Pool;
  let app: ReturnType<typeof buildApp>;
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  before(async () => {
    db = await createTestDb();
    await seed(db.pool);
    appRole = `tazumo_api_test_${randomBytes(4).toString('hex')}`;
    const password = randomBytes(16).toString('hex');
    await db.pool.query(`CREATE ROLE ${appRole} LOGIN PASSWORD '${password}' IN ROLE tazumo_api`);
    const url = new URL(databaseUrl());
    url.username = appRole;
    url.password = password;
    appPool = createPool({ databaseUrl: url.toString(), schema: db.schema });
    key = await signingKey('admin-tests');
    idp = await startIdp([key]);
    app = buildApp({ pool: appPool, auth: { issuer, audience, jwksUrl: idp.url } });
    await app.ready();
    for (const name of ['admin', 'customer', 'staff', 'support', 'target', 'target2']) {
      tokens[name] = await mint(key, { sub: `admin-test-${name}` });
      const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${tokens[name]}` } });
      assert.equal(res.statusCode, 200);
      ids[name] = res.json().userId;
    }
    await db.pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin'), ($2, 'support')`, [ids.admin, ids.support]);
    await db.pool.query(`INSERT INTO user_roles (user_id, role, merchant_id) VALUES ($1, 'merchant_staff', $2)`, [ids.staff, merchantA]);
  });
  after(async () => {
    try {
      await app?.close();
      await idp?.close();
      await appPool?.end();
    } finally {
      await db.pool.query(`DROP ROLE IF EXISTS ${appRole}`);
      await db.drop();
    }
  });

  const call = (method: 'PUT' | 'DELETE', as: string, userId: string, role: string, merchantId?: string) =>
    app.inject({
      method,
      url: `/v1/admin/users/${userId}/roles/${role}${merchantId ? `?merchantId=${merchantId}` : ''}`,
      headers: as ? { authorization: `Bearer ${tokens[as]}` } : {}
    });
  const roles = async (name: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${tokens[name]}` } })).json().roles;
  const auditRows = async () =>
    (await db.pool.query(`SELECT actor_user_id, action, resource_id, details FROM audit_events WHERE action LIKE 'role:%' ORDER BY id`)).rows;

  test('grants are idempotent, audited once and effective on the next request', async () => {
    const first = await call('PUT', 'admin', ids.target, 'support');
    assert.equal(first.statusCode, 201);
    assertMatchesContract('put', rolePath, 201, first.json());
    assert.deepEqual(first.json(), { role: 'support', merchantId: null });
    const again = await call('PUT', 'admin', ids.target, 'support');
    assert.equal(again.statusCode, 200);
    assertMatchesContract('put', rolePath, 200, again.json());
    assert.deepEqual(await roles('target'), [
      { role: 'customer', merchantId: null },
      { role: 'support', merchantId: null }
    ]);
    assert.equal((await call('PUT', 'admin', ids.target2, 'merchant_staff', merchantA)).statusCode, 201);
    assert.deepEqual(await auditRows(), [
      { actor_user_id: ids.admin, action: 'role:grant', resource_id: ids.target, details: { role: 'support', merchantId: null } },
      { actor_user_id: ids.admin, action: 'role:grant', resource_id: ids.target2, details: { role: 'merchant_staff', merchantId: merchantA } }
    ]);
  });

  test('revokes are idempotent, audited once and effective on the next request', async () => {
    await db.pool.query(`INSERT INTO user_roles (user_id, role, merchant_id) VALUES ($1, 'merchant_staff', $2) ON CONFLICT DO NOTHING`, [
      ids.target2,
      merchantA
    ]);
    const staffList = () =>
      app.inject({ method: 'GET', url: `/v1/merchants/${merchantA}/staff`, headers: { authorization: `Bearer ${tokens.target2}` } });
    assert.equal((await staffList()).statusCode, 200);
    assert.equal((await call('DELETE', 'admin', ids.target2, 'merchant_staff', merchantA)).statusCode, 204);
    assert.equal((await call('DELETE', 'admin', ids.target2, 'merchant_staff', merchantA)).statusCode, 204);
    assert.equal((await staffList()).statusCode, 404);
    const revokes = (await auditRows()).filter((r) => r.action === 'role:revoke');
    assert.deepEqual(revokes, [
      { actor_user_id: ids.admin, action: 'role:revoke', resource_id: ids.target2, details: { role: 'merchant_staff', merchantId: merchantA } }
    ]);
  });

  test('only admins manage roles, nobody escalates themselves', async () => {
    const before = (await auditRows()).length;
    for (const as of ['customer', 'staff', 'support']) {
      const res = await call('PUT', as, ids.target2, 'support');
      assert.equal(res.statusCode, 403, `${as} must not grant roles`);
      assertMatchesContract('put', rolePath, 403, res.json());
      assert.equal((await call('DELETE', as, ids.target, 'support')).statusCode, 403, `${as} must not revoke roles`);
    }
    assert.equal((await call('PUT', 'customer', ids.customer, 'support')).statusCode, 403, 'self-escalation');
    assert.equal((await call('PUT', 'staff', ids.staff, 'merchant_staff', uuidV5('merchant:Morning Market'))).statusCode, 403);
    assert.equal((await call('PUT', 'admin', ids.admin, 'support')).statusCode, 403, 'admins cannot change their own grants');
    assert.equal((await call('PUT', 'admin', ids.admin.toUpperCase(), 'support')).statusCode, 403, 'case variants are the same user');
    assert.equal((await call('PUT', 'admin', ids.admin.toUpperCase(), 'merchant_staff', merchantA.toUpperCase())).statusCode, 403);
    assert.equal((await call('DELETE', 'admin', ids.admin, 'support')).statusCode, 403);
    assert.equal((await call('PUT', '', ids.target2, 'support')).statusCode, 401);
    assert.equal((await auditRows()).length, before, 'denied attempts change nothing');
    assert.deepEqual(await roles('customer'), [{ role: 'customer', merchantId: null }]);
  });

  test('unknown users and merchants return 404, invalid requests 400', async () => {
    const unknownUser = await call('PUT', 'admin', '00000000-0000-4000-8000-000000000000', 'support');
    assert.equal(unknownUser.statusCode, 404);
    assert.equal(unknownUser.json().code, 'user_not_found');
    assertMatchesContract('put', rolePath, 404, unknownUser.json());
    const unknownMerchant = await call('PUT', 'admin', ids.target2, 'merchant_staff', '00000000-0000-4000-8000-000000000000');
    assert.equal(unknownMerchant.json().code, 'merchant_not_found');
    assert.equal((await call('DELETE', 'admin', '00000000-0000-4000-8000-000000000000', 'support')).statusCode, 404);
    for (const [userId, role, merchantId] of [
      [ids.target2, 'admin'],
      [ids.target2, 'customer'],
      [ids.target2, 'merchant_staff'],
      [ids.target2, 'support', merchantA],
      ['not-a-uuid', 'support'],
      [`urn:uuid:${ids.target2}`, 'support'],
      [ids.target2, 'merchant_staff', 'not-a-uuid']
    ] as Array<[string, string, string?]>) {
      const res = await call('PUT', 'admin', userId, role, merchantId);
      assert.equal(res.statusCode, 400, `${role} ${userId} ${merchantId ?? ''}`);
      assertMatchesContract('put', rolePath, 400, res.json());
    }
  });

  test('upper-case IDs are canonicalised in responses and audit rows', async () => {
    const res = await call('PUT', 'admin', ids.target.toUpperCase(), 'merchant_staff', merchantA.toUpperCase());
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json(), { role: 'merchant_staff', merchantId: merchantA });
    const rows = (await auditRows()).filter((r) => r.resource_id === ids.target && r.details.role === 'merchant_staff');
    assert.deepEqual(rows.map((r) => r.details.merchantId), [merchantA]);
  });

  test('concurrent identical grants create one grant and one audit row', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => call('PUT', 'admin', ids.customer, 'support')));
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 200, 200, 200, 200, 200, 200, 201]);
    const rows = (await auditRows()).filter((r) => r.resource_id === ids.customer && r.action === 'role:grant');
    assert.equal(rows.length, 1);
    await db.pool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role = 'support'`, [ids.customer]);
  });

  test('row-level security stops the runtime role from granting or removing admin', async () => {
    await assert.rejects(
      appPool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`, [ids.customer]),
      /row-level security/
    );
    await assert.rejects(appPool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'courier')`, [ids.customer]), /row-level security/);
    const removed = await appPool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role = 'admin'`, [ids.admin]);
    assert.equal(removed.rowCount, 0);
    assert.equal((await db.pool.query(`SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'`, [ids.admin])).rowCount, 1);
  });

  test('the runtime role can only append to the audit log and only read the catalogue', async () => {
    await appPool.query(`INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, request_id) VALUES ($1, 'probe', 'user', $2, 'probe')`, [ids.admin, ids.admin]);
    for (const sql of [
      `UPDATE audit_events SET action = 'x'`,
      `DELETE FROM audit_events`,
      `TRUNCATE audit_events`,
      `SELECT * FROM audit_events`,
      `UPDATE users SET subject = 'x'`,
      `INSERT INTO products (id, slug, merchant_id, category_code, name, price_minor, currency) VALUES (gen_random_uuid(), 'x', '${merchantA}', 'food', 'X', 1, 'EUR')`,
      `UPDATE merchants SET accepting_orders = true`,
      `SELECT * FROM schema_migrations`
    ]) {
      await assert.rejects(appPool.query(sql), /permission denied/, sql);
    }
    for (const sql of [`ALTER TABLE audit_events DISABLE TRIGGER ALL`, `DROP TABLE audit_events`]) {
      await assert.rejects(appPool.query(sql), /must be owner/, sql);
    }
  });
});
