import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { FixedWindowLimiter } from '../src/rate-limit.ts';
import { assertMatchesContract, createTestDb, type TestDb } from './helpers.ts';
import { audience, issuer, mint, signingKey, startIdp, type SigningKey, type TestIdp } from './idp.ts';

test('fixed window limiter counts per key and resets on a simulated clock', () => {
  let now = 0;
  const limiter = new FixedWindowLimiter({ limit: 2, windowMs: 10_000 }, () => now);
  assert.deepEqual(limiter.hit('a'), { allowed: true });
  assert.deepEqual(limiter.hit('a'), { allowed: true });
  now = 2_500;
  assert.deepEqual(limiter.hit('a'), { allowed: false, retryAfterSeconds: 8 });
  assert.deepEqual(limiter.hit('b'), { allowed: true });
  now = 10_000;
  assert.deepEqual(limiter.hit('a'), { allowed: true });
});

test('limiter memory is bounded', () => {
  let now = 0;
  const limiter = new FixedWindowLimiter({ limit: 1, windowMs: 1_000 }, () => now, 3);
  for (const key of ['a', 'b', 'c', 'd', 'e']) assert.deepEqual(limiter.hit(key), { allowed: true });
  now = 5_000;
  assert.deepEqual(limiter.hit('f'), { allowed: true });
});

describe('rate limits on authenticated routes', () => {
  let db: TestDb;
  let idp: TestIdp;
  let key: SigningKey;
  let clock = 1_000_000;
  let app: ReturnType<typeof buildApp>;

  before(async () => {
    db = await createTestDb();
    key = await signingKey('limits');
    idp = await startIdp([key]);
    app = buildApp({
      pool: db.pool,
      auth: { issuer, audience, jwksUrl: idp.url },
      rateLimits: { ip: { limit: 5, windowMs: 60_000 }, principal: { limit: 2, windowMs: 60_000 }, now: () => clock }
    });
    await app.ready();
  });
  after(async () => {
    await app.close();
    await idp.close();
    await db.drop();
  });

  const me = async (sub: string, remoteAddress: string) =>
    app.inject({ method: 'GET', url: '/v1/me', remoteAddress, headers: { authorization: `Bearer ${await mint(key, { sub })}` } });

  test('per-principal limit returns 429 with Retry-After and resets after the window', async () => {
    assert.equal((await me('limited-a', '198.51.100.1')).statusCode, 200);
    assert.equal((await me('limited-a', '198.51.100.2')).statusCode, 200);
    const limited = await me('limited-a', '198.51.100.3');
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '60');
    assert.equal(limited.json().code, 'rate_limited');
    assertMatchesContract('get', '/v1/me', 429, limited.json());
    assert.equal((await me('limited-b', '198.51.100.4')).statusCode, 200, 'other principals are unaffected');
    clock += 30_000;
    assert.equal((await me('limited-a', '198.51.100.5')).headers['retry-after'], '30');
    clock += 30_000;
    assert.equal((await me('limited-a', '198.51.100.6')).statusCode, 200);
  });

  test('per-IP limit stops token floods before verification', async () => {
    const ip = '203.0.113.50';
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/v1/me', remoteAddress: ip, headers: { authorization: 'Bearer a.b.c' } });
      assert.equal(res.statusCode, 401);
    }
    const fetches = idp.fetches;
    const blocked = await me('flood-valid-token', ip);
    assert.equal(blocked.statusCode, 429);
    assert.ok(Number(blocked.headers['retry-after']) >= 1);
    assert.equal(idp.fetches, fetches, 'no JWKS fetch for a rate-limited request');
    const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM users WHERE subject = 'flood-valid-token'`);
    assert.equal(rows[0].n, 0, 'rate-limited requests never reach authentication');
  });

  test('anonymous discovery routes are not rate limited by these layers', async () => {
    for (let i = 0; i < 10; i++) {
      assert.equal((await app.inject({ method: 'GET', url: '/v1/markets', remoteAddress: '203.0.113.50' })).statusCode, 200);
    }
  });
});
