import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { buildApp } from '../src/app.ts';
import { seed } from '../src/seed.ts';
import { assertMatchesContract, createAppRolePool, createTestDb, type TestDb } from './helpers.ts';
import { audience, issuer, mint, signingKey, startIdp, type SigningKey, type TestIdp } from './idp.ts';

const now = () => Math.floor(Date.now() / 1000);

describe('GDPR erasure and export, running as tazumo_api', () => {
  let db: TestDb;
  let idp: TestIdp;
  let key: SigningKey;
  let appRole: { pool: pg.Pool; drop: () => Promise<void> };
  let app: ReturnType<typeof buildApp>;
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const subjects = (name: string) => `privacy-${name}-subject`;

  before(async () => {
    db = await createTestDb();
    await seed(db.pool);
    appRole = await createAppRolePool(db);
    key = await signingKey('privacy');
    idp = await startIdp([key]);
    app = buildApp({ pool: appRole.pool, auth: { issuer, audience, jwksUrl: idp.url, logSalt: 'p'.repeat(32) } });
    await app.ready();
    for (const name of ['admin', 'support', 'staff', 'customer', 'self', 'target', 'target2', 'exporter']) {
      tokens[name] = await mint(key, { sub: subjects(name), iat: now() - 5 });
      const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${tokens[name]}` } });
      assert.equal(res.statusCode, 200);
      ids[name] = res.json().userId;
    }
    await db.pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin'), ($2, 'support')`, [ids.admin, ids.support]);
    await db.pool.query(`INSERT INTO user_roles (user_id, role, merchant_id) SELECT $1, 'merchant_staff', id FROM merchants LIMIT 1`, [ids.staff]);
  });
  after(async () => {
    try {
      await app?.close();
      await idp?.close();
      await appRole?.drop();
    } finally {
      await db.drop();
    }
  });

  const as = (name: string) => ({ authorization: `Bearer ${tokens[name]}` });
  const eraseAs = (name: string, userId: string) =>
    app.inject({ method: 'POST', url: `/v1/admin/users/${userId}/erasure`, headers: as(name) });
  const userRow = async (id: string) =>
    (await db.pool.query(`SELECT issuer, subject, erased_at FROM users WHERE id = $1`, [id])).rows[0];
  const eraseAudit = async (id: string) =>
    (await db.pool.query(`SELECT actor_user_id, details FROM audit_events WHERE action = 'user:erase' AND resource_id = $1`, [id])).rows;

  test('export returns only the caller\'s own data', async () => {
    assert.equal(
      (await app.inject({ method: 'PUT', url: `/v1/admin/users/${ids.exporter}/roles/support`, headers: as('admin') })).statusCode,
      201
    );
    const res = await app.inject({ method: 'GET', url: '/v1/me/export', headers: as('exporter') });
    assert.equal(res.statusCode, 200);
    assertMatchesContract('get', '/v1/me/export', 200, res.json());
    const data = res.json();
    assert.equal(data.userId, ids.exporter);
    assert.equal(data.subject, subjects('exporter'));
    assert.deepEqual(data.roles.map((r: { role: string }) => r.role).sort(), ['customer', 'support']);
    assert.deepEqual(
      data.auditEvents.map((e: { action: string; resourceId: string; initiatedBy: string }) => [e.action, e.resourceId, e.initiatedBy]),
      [['role:grant', ids.exporter, 'staff']]
    );
    const other = (await app.inject({ method: 'GET', url: '/v1/me/export', headers: as('customer') })).json();
    assert.deepEqual(other.auditEvents, []);
  });

  test('self-service erasure pseudonymises, removes grants, audits and invalidates earlier tokens', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: as('self') });
    assert.equal(res.statusCode, 200);
    assertMatchesContract('post', '/v1/me/erasure', 200, res.json());
    assert.equal(res.json().userId, ids.self);
    const row = await userRow(ids.self);
    assert.match(row.subject, /^erased:[0-9a-f]{64}$/);
    assert.ok(row.erased_at);
    assert.equal((await db.pool.query('SELECT 1 FROM user_roles WHERE user_id = $1', [ids.self])).rowCount, 0);
    assert.deepEqual(await eraseAudit(ids.self), [{ actor_user_id: ids.self, details: { initiator: 'self' } }]);

    for (const token of [tokens.self, await mint(key, { sub: subjects('self'), iat: now() - 1 })]) {
      const again = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
      assert.equal(again.statusCode, 401, 'tokens issued before the erasure are rejected');
      assert.equal(again.json().code, 'invalid_token');
    }
    const doubleErase = await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: as('self') });
    assert.equal(doubleErase.statusCode, 401);
    assert.equal((await eraseAudit(ids.self)).length, 1);
  });

  test('a token issued after the erasure re-provisions a new, unlinked customer', async () => {
    const later = await mint(key, { sub: subjects('self'), iat: now() + 2 });
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${later}` } });
    assert.equal(res.statusCode, 200);
    assert.notEqual(res.json().userId, ids.self);
    assert.deepEqual(res.json().roles, [{ role: 'customer', merchantId: null }]);
    assert.match((await userRow(ids.self)).subject, /^erased:/, 'the erased record stays pseudonymous');
  });

  test('admin and support erase on behalf, idempotently', async () => {
    const first = await eraseAs('admin', ids.target);
    assert.equal(first.statusCode, 200);
    assertMatchesContract('post', '/v1/admin/users/{userId}/erasure', 200, first.json());
    const second = await eraseAs('admin', ids.target.toUpperCase());
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().erasedAt, first.json().erasedAt);
    assert.deepEqual(await eraseAudit(ids.target), [{ actor_user_id: ids.admin, details: { initiator: 'admin' } }]);
    assert.equal((await eraseAs('support', ids.target2)).statusCode, 200);
    assert.deepEqual(await eraseAudit(ids.target2), [{ actor_user_id: ids.support, details: { initiator: 'support' } }]);
  });

  test('users without permission cannot erase others', async () => {
    for (const name of ['customer', 'staff']) {
      const res = await eraseAs(name, ids.exporter);
      assert.equal(res.statusCode, 403, `${name} must not erase other users`);
      assertMatchesContract('post', '/v1/admin/users/{userId}/erasure', 403, res.json());
    }
    assert.equal((await userRow(ids.exporter)).erased_at, null);
    assert.equal((await app.inject({ method: 'POST', url: `/v1/admin/users/${ids.exporter}/erasure` })).statusCode, 401);
  });

  test('erasure is blocked while dependent records exist; unknown and malformed targets fail', async () => {
    for (const res of [await eraseAs('support', ids.admin), await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: as('admin') })]) {
      assert.equal(res.statusCode, 409);
      assert.equal(res.json().code, 'erasure_blocked');
      assert.deepEqual(res.json().details, { blockers: ['admin_grant'] });
    }
    assert.equal((await userRow(ids.admin)).erased_at, null);
    const unknown = await eraseAs('admin', '00000000-0000-4000-8000-000000000000');
    assert.equal(unknown.statusCode, 404);
    assertMatchesContract('post', '/v1/admin/users/{userId}/erasure', 404, unknown.json());
    assert.equal((await eraseAs('admin', 'not-a-uuid')).statusCode, 400);
  });

  test('tokens cannot claim an erased-style subject', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${await mint(key, { sub: 'erased:' + 'a'.repeat(64) })}` }
    });
    assert.equal(res.statusCode, 401);
  });

  test('no erased subject appears anywhere in users or the audit log', async () => {
    const dump = JSON.stringify([
      (await db.pool.query('SELECT * FROM users')).rows,
      (await db.pool.query('SELECT * FROM audit_events')).rows
    ]);
    for (const name of ['target', 'target2']) assert.ok(!dump.includes(subjects(name)), `${name} subject leaked`);
    const selfRows = (await db.pool.query(`SELECT 1 FROM users WHERE subject = $1`, [subjects('self')])).rowCount;
    assert.equal(selfRows, 1, 'only the re-provisioned record carries the subject again');
  });
});
