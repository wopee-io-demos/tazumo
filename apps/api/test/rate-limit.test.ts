import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { uuidV5 } from '../src/fixtures.ts';
import { seed } from '../src/seed.ts';
import { clientKey, FixedWindowLimiter, rateLimitTier } from '../src/rate-limit.ts';
import { assertMatchesContract, createTestDb, type TestDb } from './helpers.ts';
import { audience, issuer, logSalt, mint, signingKey, startIdp, type SigningKey, type TestIdp } from './idp.ts';

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

test('limiter memory is bounded and a full table never frees a blocked key', () => {
  let now = 0;
  const limiter = new FixedWindowLimiter({ limit: 1, windowMs: 1_000 }, () => now, 3);
  assert.deepEqual(limiter.hit('x'), { allowed: true });
  assert.equal(limiter.hit('x').allowed, false);
  now = 100;
  assert.deepEqual(limiter.hit('a'), { allowed: true });
  assert.deepEqual(limiter.hit('b'), { allowed: true });
  assert.deepEqual(limiter.hit('c'), { allowed: true }, 'new keys share the overflow bucket while the table is full');
  assert.equal(limiter.size, 3);
  assert.equal(limiter.hit('x').allowed, false, 'blocked key stays blocked');
  for (let i = 0; i < 9; i++) assert.equal(limiter.hit(`overflow-${i}`).allowed, true);
  assert.deepEqual(limiter.hit('overflow-last'), { allowed: false, retryAfterSeconds: 1 }, 'overflow bucket allows 10x the limit');
  now = 1_000;
  assert.deepEqual(limiter.hit('c'), { allowed: true }, 'expired windows are swept');
  assert.ok(limiter.size <= 3);
});

test('a reset window moves to the back of the eviction order', () => {
  let now = 0;
  const limiter = new FixedWindowLimiter({ limit: 1, windowMs: 1_000 }, () => now, 2);
  limiter.hit('a');
  now = 500;
  limiter.hit('b');
  now = 1_000;
  limiter.hit('a');
  now = 1_500;
  assert.equal(limiter.hit('a').allowed, false, 'a was reset at 1000 and is still in its window');
  assert.deepEqual(limiter.hit('c'), { allowed: true }, 'b expired and was swept');
});

test('client keys group IPv6 by /64 and unwrap IPv4-mapped addresses', () => {
  assert.equal(clientKey('2001:db8:1:2:aaaa::1'), clientKey('2001:db8:1:2:ffff:ffff:ffff:ffff'));
  assert.notEqual(clientKey('2001:db8:1:2::1'), clientKey('2001:db8:1:3::1'));
  assert.equal(clientKey('2001:db8::1'), '2001:0db8:0000:0000::/64');
  assert.equal(clientKey('::ffff:203.0.113.9'), '203.0.113.9');
  assert.equal(clientKey('203.0.113.9'), '203.0.113.9');
  assert.equal(clientKey('not-an-ip'), clientKey('also-not-an-ip'), 'non-IP values share one key');
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
      auth: { issuer, audience, logSalt, jwksUrl: idp.url },
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
    const floodIdp = await startIdp([key]);
    const flooded = buildApp({
      pool: db.pool,
      auth: { issuer, audience, logSalt, jwksUrl: floodIdp.url },
      rateLimits: { ip: { limit: 5, windowMs: 60_000 }, now: () => clock }
    });
    try {
      for (let i = 0; i < 5; i++) {
        const res = await flooded.inject({ method: 'GET', url: '/v1/me', remoteAddress: '2001:db8:9:9::' + (i + 1), headers: { authorization: 'Bearer a.b.c' } });
        assert.equal(res.statusCode, 401);
      }
      const blocked = await flooded.inject({
        method: 'GET',
        url: '/v1/me',
        remoteAddress: '2001:db8:9:9:ffff::7',
        headers: { authorization: `Bearer ${await mint(key, { sub: 'flood-valid-token' })}` }
      });
      assert.equal(blocked.statusCode, 429, 'the whole /64 shares one bucket');
      assert.ok(Number(blocked.headers['retry-after']) >= 1);
      assert.equal(floodIdp.fetches, 0, 'no JWKS fetch for a rate-limited request');
      const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM users WHERE subject = 'flood-valid-token'`);
      assert.equal(rows[0].n, 0, 'rate-limited requests never reach authentication');
    } finally {
      await flooded.close();
      await floodIdp.close();
    }
  });

  test('anonymous discovery traffic does not consume the authenticated budgets', async () => {
    for (let i = 0; i < 10; i++) {
      assert.equal((await app.inject({ method: 'GET', url: '/v1/markets', remoteAddress: '203.0.113.50' })).statusCode, 200);
    }
  });
});

describe('rate limits on public and health routes', () => {
  let db: TestDb;
  let clock = 5_000_000;
  const merchant = uuidV5('merchant:Piazza Local');
  const publicUrls = ['/v1/markets', '/v1/merchants?marketCode=demo-eu', `/v1/merchants/${merchant}/products`];

  before(async () => {
    db = await createTestDb();
    await seed(db.pool);
  });
  after(async () => {
    await db.drop();
  });

  const build = (limits: Parameters<typeof buildApp>[0]['rateLimits'] = {}) =>
    buildApp({ pool: db.pool, rateLimits: { now: () => clock, ...limits } });

  test('public routes return 429 with Retry-After past the per-IP limit and reset after the window', async () => {
    const app = build({ public: { limit: 3, windowMs: 60_000 } });
    try {
      for (const url of publicUrls) {
        const ip = `198.18.0.${publicUrls.indexOf(url) + 1}`;
        for (let i = 0; i < 3; i++) assert.equal((await app.inject({ method: 'GET', url, remoteAddress: ip })).statusCode, 200);
        const limited = await app.inject({ method: 'GET', url, remoteAddress: ip });
        assert.equal(limited.statusCode, 429, url);
        assert.equal(limited.headers['retry-after'], '60');
        assertMatchesContract('get', url.split('?')[0].replace(merchant, '{merchantId}'), 429, limited.json());
        assert.equal((await app.inject({ method: 'GET', url, remoteAddress: '198.18.1.1' })).statusCode, 200, 'other clients are unaffected');
      }
      clock += 60_000;
      assert.equal((await app.inject({ method: 'GET', url: '/v1/markets', remoteAddress: '198.18.0.1' })).statusCode, 200);
    } finally {
      await app.close();
    }
  });

  test('health probes have their own, higher budget', async () => {
    const app = build({ public: { limit: 1, windowMs: 60_000 }, health: { limit: 5, windowMs: 60_000 } });
    try {
      const ip = '198.18.2.1';
      assert.equal((await app.inject({ method: 'GET', url: '/v1/markets', remoteAddress: ip })).statusCode, 200);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/markets', remoteAddress: ip })).statusCode, 429);
      for (let i = 0; i < 5; i++) assert.equal((await app.inject({ method: 'GET', url: '/health', remoteAddress: ip })).statusCode, 200);
      const limited = await app.inject({ method: 'GET', url: '/health', remoteAddress: ip });
      assert.equal(limited.statusCode, 429);
      assert.ok(Number(limited.headers['retry-after']) >= 1);
    } finally {
      await app.close();
    }
  });

  test('unmatched paths and methods share the public limit', async () => {
    const app = build({ public: { limit: 2, windowMs: 60_000 } });
    try {
      const ip = '198.18.3.1';
      assert.equal((await app.inject({ method: 'GET', url: '/nope', remoteAddress: ip })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: '/v1/markets', remoteAddress: ip })).statusCode, 404);
      assert.equal((await app.inject({ method: 'GET', url: '/nope', remoteAddress: ip })).statusCode, 429);
    } finally {
      await app.close();
    }
  });

  test('every registered route is rate limited', async () => {
    const one = { limit: 1, windowMs: 60_000 };
    const app = build({ public: one, health: one, ip: one, principal: one });
    const routes: Array<{ method: string; url: string }> = [];
    app.addHook('onRoute', (route) => {
      for (const method of [route.method].flat()) routes.push({ method, url: route.url.replace(/:\w+/g, merchant) });
    });
    try {
      await app.ready();
      assert.equal(routes.length, 19, '11 contract operations, /health, and a HEAD route for every GET');
      for (const [index, route] of routes.entries()) {
        const remoteAddress = `198.19.${Math.floor(index / 250)}.${(index % 250) + 1}`;
        const call = () => app.inject({ method: route.method as 'GET', url: route.url, remoteAddress });
        await call();
        const second = await call();
        assert.equal(second.statusCode, 429, `${route.method} ${route.url} must be rate limited`);
      }
    } finally {
      await app.close();
    }
  });

  test('a route without a rate-limit tier, or with the wrong tier, fails at startup', async () => {
    const app = build();
    try {
      assert.throws(() => app.get('/unlimited', async () => ({})), /declares no rate-limit tier/);
      assert.throws(() => app.get('/v1/me', { config: { rateLimit: rateLimitTier.public } }, async () => ({})), /does not match the contract/);
      assert.throws(() => app.get('/anon', { config: { rateLimit: rateLimitTier.authenticated } }, async () => ({})), /does not match the contract/);
      assert.throws(() => app.get('/anon2', { config: { rateLimit: rateLimitTier.health } }, async () => ({})), /expected public/);
      assert.throws(() => app.get('/health2', { config: { rateLimit: { tier: 'typo' as 'public' } } }, async () => ({})), /does not match/);
    } finally {
      await app.close().catch(() => {});
    }
  });
});
