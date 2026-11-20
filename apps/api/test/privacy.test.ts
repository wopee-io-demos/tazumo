import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { buildApp } from '../src/app.ts';
import { seed } from '../src/seed.ts';
import { assertMatchesContract, createAppRolePool, createTestDb, type TestDb } from './helpers.ts';
import { audience, issuer, logSalt, mint, signingKey, startIdp, type SigningKey, type TestIdp } from './idp.ts';

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
    app = buildApp({ pool: appRole.pool, auth: { issuer, audience, logSalt, jwksUrl: idp.url } });
    await app.ready();
    for (const name of ['admin', 'support', 'support2', 'staff', 'customer', 'self', 'target', 'target2', 'exporter', 'again', 'forgotten']) {
      tokens[name] = await mint(key, { sub: subjects(name), iat: now() - 5 });
      const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${tokens[name]}` } });
      assert.equal(res.statusCode, 200);
      ids[name] = res.json().userId;
    }
    await db.pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin'), ($2, 'support'), ($3, 'support')`, [
      ids.admin,
      ids.support,
      ids.support2
    ]);
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
      data.auditEvents.map((e: { action: string; resourceId: string; initiatedBy: string; details: object }) => [
        e.action,
        e.resourceId,
        e.initiatedBy,
        e.details
      ]),
      [['role:grant', ids.exporter, 'staff', { role: 'support' }]]
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

    const erasedSecond = Math.ceil(Date.parse(res.json().erasedAt) / 1000);
    for (const iat of [null, erasedSecond - 1, erasedSecond + 59]) {
      const token = iat === null ? tokens.self : await mint(key, { sub: subjects('self'), iat });
      const again = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
      assert.equal(again.statusCode, 401, `token with iat ${iat ?? 'original'} must be rejected`);
      assert.equal(again.json().code, 'invalid_token');
    }
    const doubleErase = await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: as('self') });
    assert.equal(doubleErase.statusCode, 401);
    assert.equal((await eraseAudit(ids.self)).length, 1);
  });

  test('a token issued after the erasure re-provisions a new, unlinked customer', async () => {
    await db.pool.query(`UPDATE users SET erased_at = erased_at - interval '10 minutes' WHERE id = $1`, [ids.self]);
    const later = await mint(key, { sub: subjects('self'), iat: now() - 5 });
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

  test('erasing a re-provisioned subject again supersedes the older tombstone', async () => {
    const first = await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: as('again') });
    assert.equal(first.statusCode, 200);
    await db.pool.query(`UPDATE users SET erased_at = erased_at - interval '10 minutes' WHERE id = $1`, [ids.again]);
    const fresh = await mint(key, { sub: subjects('again'), iat: now() - 5 });
    const reprovisioned = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${fresh}` } });
    assert.equal(reprovisioned.statusCode, 200);
    const second = await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: { authorization: `Bearer ${fresh}` } });
    assert.equal(second.statusCode, 200);
    assert.match((await userRow(ids.again)).subject, /^erased:r:[0-9a-f]{64}$/, 'older record gets a random tombstone');
    assert.match((await userRow(reprovisioned.json().userId)).subject, /^erased:[0-9a-f]{64}$/);
  });

  test('erased users cannot receive grants, even through the runtime role directly', async () => {
    const res = await app.inject({ method: 'PUT', url: `/v1/admin/users/${ids.target}/roles/support`, headers: as('admin') });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, 'user_erased');
    assertMatchesContract('put', '/v1/admin/users/{userId}/roles/{role}', 409, res.json());
    await assert.rejects(appRole.pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'support')`, [ids.target]), /user_erased/);
  });

  test('support cannot erase staff accounts; admins can', async () => {
    const blocked = await eraseAs('support', ids.support2);
    assert.equal(blocked.statusCode, 409);
    assert.deepEqual(blocked.json().details, { blockers: ['staff_grant'] });
    assert.deepEqual((await eraseAs('support', ids.staff)).json().details, { blockers: ['staff_grant'] });
    assert.equal((await eraseAs('admin', ids.support2)).statusCode, 200);
  });

  test('the runtime role cannot rewrite identities and the database validates erasure input', async () => {
    await assert.rejects(appRole.pool.query(`UPDATE users SET subject = 'attacker-sub' WHERE id = $1`, [ids.admin]), /permission denied/);
    await assert.rejects(
      appRole.pool.query(`SELECT * FROM erase_user($1, 'erased:nothex', $1, 'self', 'r')`, [ids.customer]),
      /invalid pseudonym/
    );
    await assert.rejects(
      appRole.pool.query(`SELECT * FROM erase_user($1, $2, $1, 'root', 'r')`, [ids.customer, 'erased:' + 'a'.repeat(64)]),
      /invalid initiator/
    );
    await assert.rejects(
      appRole.pool.query(`SELECT * FROM erase_user($1, $2, $3, 'admin', 'r')`, [ids.exporter, 'erased:' + 'b'.repeat(64), ids.customer]),
      /actor does not hold the initiator role/
    );
    await assert.rejects(
      appRole.pool.query(`SELECT * FROM erase_user($1, $2, $3, 'self', 'r')`, [ids.exporter, 'erased:' + 'b'.repeat(64), ids.customer]),
      /actor does not hold the initiator role/
    );
  });

  test('recognition of erased subjects ends after the token-lifetime window', async () => {
    assert.equal((await app.inject({ method: 'POST', url: '/v1/me/erasure', headers: as('forgotten') })).statusCode, 200);
    await db.pool.query(`UPDATE users SET erased_at = erased_at - interval '23 hours' WHERE id = $1`, [ids.forgotten]);
    assert.equal((await db.pool.query(`SELECT forget_erased_subjects() AS n`)).rows[0].n, 0, 'still inside the 24 h window');
    assert.match((await userRow(ids.forgotten)).subject, /^erased:[0-9a-f]{64}$/);
    await db.pool.query(`UPDATE users SET erased_at = erased_at - interval '2 hours' WHERE id = $1`, [ids.forgotten]);
    assert.ok((await db.pool.query(`SELECT forget_erased_subjects() AS n`)).rows[0].n >= 1);
    assert.match((await userRow(ids.forgotten)).subject, /^erased:r:/);
    await assert.rejects(appRole.pool.query(`SELECT forget_erased_subjects()`), /permission denied/, 'the runtime cannot end recognition');
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
    for (const name of ['target', 'target2', 'support2', 'again', 'forgotten']) assert.ok(!dump.includes(subjects(name)), `${name} subject leaked`);
    const selfRows = (await db.pool.query(`SELECT 1 FROM users WHERE subject = $1`, [subjects('self')])).rowCount;
    assert.equal(selfRows, 1, 'only the re-provisioned record carries the subject again');
  });
});
