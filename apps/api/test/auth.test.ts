import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { SignJWT } from 'jose';
import { buildApp } from '../src/app.ts';
import { contract, toFastifyPath } from '../src/contract.ts';
import { listMerchantStaff } from '../src/routes/identity.ts';
import { loadConfig } from '../src/config.ts';
import { uuidV5 } from '../src/fixtures.ts';
import { seed } from '../src/seed.ts';
import { assertMatchesContract, createTestDb, type TestDb } from './helpers.ts';
import { audience, b64url, issuer, mint, signingKey, startIdp, type SigningKey, type TestIdp } from './idp.ts';

const merchantA = uuidV5('merchant:Piazza Local');
const merchantB = uuidV5('merchant:Morning Market');
const now = () => Math.floor(Date.now() / 1000);
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('authentication and authorization', () => {
  let db: TestDb;
  let idp: TestIdp;
  let rsa: SigningKey;
  let ec: SigningKey;
  let rs384: SigningKey;
  let app: ReturnType<typeof buildApp>;
  const logLines: string[] = [];

  before(async () => {
    db = await createTestDb();
    await seed(db.pool);
    rsa = await signingKey('rsa-1', 'RS256');
    ec = await signingKey('ec-1', 'ES256');
    rs384 = await signingKey('rs384-no-alg', 'RS384', { publishAlg: false });
    idp = await startIdp([rsa, ec, rs384]);
    const stream = new Writable({ write: (chunk, _e, done) => (logLines.push(chunk.toString()), done()) });
    app = buildApp({ pool: db.pool, logger: { level: 'info', stream }, auth: { issuer, audience, jwksUrl: idp.url, jwksCooldownMs: 0 } });
    await app.ready();
  });
  after(async () => {
    await app.close();
    await idp.close();
    await db.drop();
  });

  const sentTokens: string[] = [];
  const remember = (headers: Record<string, string>) => {
    if (headers.authorization) sentTokens.push(headers.authorization.replace(/^Bearer /, ''));
    return headers;
  };
  const me = (headers: Record<string, string> = {}) => app.inject({ method: 'GET', url: '/v1/me', headers: remember(headers) });
  const staff = (merchantId: string, token?: string) =>
    app.inject({ method: 'GET', url: `/v1/merchants/${merchantId}/staff`, headers: remember(token ? bearer(token) : {}) });

  test('discovery stays anonymous and ignores bad tokens', async () => {
    for (const headers of [{}, { authorization: 'Bearer not-a-token' }]) {
      assert.equal((await app.inject({ method: 'GET', url: '/v1/markets', headers })).statusCode, 200);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/merchants?marketCode=demo-eu', headers })).statusCode, 200);
      assert.equal((await app.inject({ method: 'GET', url: `/v1/merchants/${merchantA}/products`, headers })).statusCode, 200);
    }
  });

  test('protected routes require a bearer token', async () => {
    for (const headers of [{}, { authorization: 'Basic dXNlcjpwYXNz' }, { authorization: 'Bearer' }] as Record<string, string>[]) {
      const res = await me(headers);
      assert.equal(res.statusCode, 401);
      assert.equal(res.headers['www-authenticate'], 'Bearer realm="tazumo"');
      assert.equal(res.json().code, 'unauthenticated');
      assertMatchesContract('get', '/v1/me', 401, res.json());
    }
    assert.equal((await staff(merchantA)).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/merchants/not-a-uuid/staff' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'HEAD', url: '/v1/me' })).statusCode, 401);
    assert.equal((await me({ authorization: `bearer ${await mint(rsa, { sub: 'lowercase-scheme' })}` })).statusCode, 200);
  });

  test('every registered route the contract marks BearerAuth rejects anonymous calls', async () => {
    const protectedOps = new Set(
      Object.entries(contract.paths).flatMap(([path, ops]) =>
        Object.entries(ops)
          .filter(([, op]) => (op as { security?: Record<string, unknown>[] }).security?.some((s) => 'BearerAuth' in s))
          .map(([method]) => `${method.toUpperCase()} ${toFastifyPath(path)}`)
      )
    );
    const routes: string[] = [];
    const probe = buildApp({ pool: db.pool, auth: { issuer, audience, jwksUrl: idp.url } });
    probe.addHook('onRoute', (route) => {
      for (const method of [route.method].flat()) if (protectedOps.has(`${method === 'HEAD' ? 'GET' : method} ${route.url}`)) routes.push(`${method} ${route.url}`);
    });
    await probe.ready();
    try {
      assert.ok(routes.length >= 4, `expected protected GET and HEAD routes, got ${routes.join(', ')}`);
      for (const route of routes) {
        const [method, url] = route.split(' ');
        const res = await probe.inject({ method: method as 'GET' | 'HEAD', url: url.replace(':merchantId', merchantA) });
        assert.equal(res.statusCode, 401, `${route} must require a bearer token`);
      }
    } finally {
      await probe.close();
    }
  });

  test('a valid RS256 or ES256 token creates the user once with the customer role', async () => {
    const first = await me(bearer(await mint(rsa, { sub: 'first-use' })));
    assert.equal(first.statusCode, 200);
    assertMatchesContract('get', '/v1/me', 200, first.json());
    assert.deepEqual(first.json().roles, [{ role: 'customer', merchantId: null }]);
    const again = await me(bearer(await mint(ec, { sub: 'first-use' })));
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().userId, first.json().userId);
    const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM users WHERE subject = 'first-use'`);
    assert.equal(rows[0].n, 1);
  });

  test('concurrent first requests create exactly one user', async () => {
    const token = await mint(rsa, { sub: 'concurrent-first-use' });
    const responses = await Promise.all(Array.from({ length: 6 }, () => me(bearer(token))));
    assert.deepEqual(new Set(responses.map((r) => r.statusCode)), new Set([200]));
    assert.equal(new Set(responses.map((r) => r.json().userId)).size, 1);
    const { rows } = await db.pool.query(
      `SELECT count(*)::int AS n FROM user_roles r JOIN users u ON u.id = r.user_id WHERE u.subject = 'concurrent-first-use'`
    );
    assert.equal(rows[0].n, 1);
  });

  test('clock skew up to 60 seconds is tolerated', async () => {
    assert.equal((await me(bearer(await mint(rsa, { iat: now() - 600, exp: now() - 30 })))).statusCode, 200);
    assert.equal((await me(bearer(await mint(rsa, { nbf: now() + 30 })))).statusCode, 200);
  });

  const invalid: Array<[string, () => Promise<string>]> = [
    ['expired token', () => mint(rsa, { iat: now() - 600, exp: now() - 120 })],
    ['token not yet valid', () => mint(rsa, { nbf: now() + 120 })],
    ['wrong audience', () => mint(rsa, { aud: 'someone-else' })],
    ['wrong issuer', () => mint(rsa, { iss: 'https://evil.test.invalid/' })],
    ['missing sub', () => mint(rsa, { sub: undefined })],
    ['missing exp', () => mint(rsa, { exp: undefined })],
    ['empty sub', () => mint(rsa, { sub: '' })],
    ['oversized sub', () => mint(rsa, { sub: 'x'.repeat(256) })],
    ['numeric sub', () => mint(rsa, { sub: 123 as unknown as string })],
    ['lifetime beyond one hour', () => mint(rsa, { exp: now() + 7200 })],
    ['long-lived token near its expiry', () => mint(rsa, { iat: now() - 7100, exp: now() + 100 })],
    ['missing iat', () => mint(rsa, { iat: undefined })],
    ['iat in the future', () => mint(rsa, { iat: now() + 600, exp: now() + 900 })],
    ['RS384, outside the algorithm allowlist', async () => mint(rs384)],
    ['unknown kid', async () => mint(await signingKey('rsa-unpublished'))],
    ['alg none', async () => `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ iss: issuer, aud: audience, sub: 'x', exp: now() + 300 })}.`],
    [
      'HS256 signed with the public key (algorithm confusion)',
      () =>
        new SignJWT({ iss: issuer, aud: audience, sub: 'x', exp: now() + 300 })
          .setProtectedHeader({ alg: 'HS256', kid: 'rsa-1' })
          .sign(new TextEncoder().encode(JSON.stringify(rsa.jwk)))
    ],
    [
      'tampered payload',
      async () => {
        const [header, , signature] = (await mint(rsa, { sub: 'victim' })).split('.');
        return `${header}.${b64url({ iss: issuer, aud: audience, sub: 'attacker', exp: now() + 300 })}.${signature}`;
      }
    ]
  ];
  for (const [name, token] of invalid) {
    test(`rejects ${name} with 401 invalid_token`, async () => {
      const res = await me(bearer(await token()));
      assert.equal(res.statusCode, 401);
      assert.equal(res.headers['www-authenticate'], 'Bearer realm="tazumo", error="invalid_token"');
      assert.equal(res.json().code, 'invalid_token');
      assertMatchesContract('get', '/v1/me', 401, res.json());
    });
  }

  test('cross-tenant access: 404 for customers, 403 for staff, audited support reads', async () => {
    const tokens = {
      customer: await mint(rsa, { sub: 'tenant-customer' }),
      staffA: await mint(rsa, { sub: 'tenant-staff-a' }),
      support: await mint(rsa, { sub: 'tenant-support' })
    };
    const ids = Object.fromEntries(
      await Promise.all(Object.entries(tokens).map(async ([k, t]) => [k, (await me(bearer(t))).json().userId]))
    );
    await db.pool.query(`INSERT INTO user_roles (user_id, role, merchant_id) VALUES ($1, 'merchant_staff', $2)`, [ids.staffA, merchantA]);
    await db.pool.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'support')`, [ids.support]);

    const own = await staff(merchantA, tokens.staffA);
    assert.equal(own.statusCode, 200);
    assertMatchesContract('get', '/v1/merchants/{merchantId}/staff', 200, own.json());
    assert.deepEqual(own.json(), [{ userId: ids.staffA, role: 'merchant_staff' }]);

    const customer = await staff(merchantA, tokens.customer);
    assert.equal(customer.statusCode, 404);
    assertMatchesContract('get', '/v1/merchants/{merchantId}/staff', 404, customer.json());
    const otherTenant = await staff(merchantB, tokens.staffA);
    assert.equal(otherTenant.statusCode, 403);
    assertMatchesContract('get', '/v1/merchants/{merchantId}/staff', 403, otherTenant.json());
    assert.equal((await staff('00000000-0000-4000-8000-000000000000', tokens.staffA)).statusCode, 404);
    assert.equal((await staff('not-a-uuid', tokens.staffA)).statusCode, 400);

    const customerPrincipal = { userId: ids.customer, grants: [{ role: 'customer' as const, merchantId: null }] };
    assert.deepEqual(await listMerchantStaff(db.pool, merchantA, customerPrincipal), [], 'SQL ownership must hold without the policy');

    const supportRead = await staff(merchantA, tokens.support);
    assert.equal(supportRead.statusCode, 200);
    const audit = await db.pool.query(`SELECT actor_user_id, action, resource_type, resource_id, request_id FROM audit_events`);
    assert.deepEqual(audit.rows, [
      {
        actor_user_id: ids.support,
        action: 'merchant_staff:list',
        resource_type: 'merchant',
        resource_id: merchantA,
        request_id: supportRead.headers['x-request-id']
      }
    ]);
    await assert.rejects(db.pool.query(`UPDATE audit_events SET action = 'x'`), /append-only/);
    await assert.rejects(db.pool.query(`DELETE FROM audit_events`), /append-only/);
    await assert.rejects(db.pool.query(`TRUNCATE audit_events`), /append-only/);
  });

  test('logs never contain tokens or raw subjects (runs last, covers the whole suite)', async () => {
    assert.equal((await me(bearer(await mint(rsa, { sub: 'secret-subject-42' })))).statusCode, 200);
    const log = logLines.join('');
    assert.match(log, /"principal":"[0-9a-f]{16}"/);
    assert.match(log, /"authFailure":"ERR_JWT_EXPIRED"/);
    for (const subject of ['secret-subject-42', 'first-use', 'victim', 'attacker', 'tenant-customer', 'tenant-staff-a', 'tenant-support']) {
      assert.ok(!log.includes(subject), `raw sub ${subject} leaked`);
    }
    assert.ok(sentTokens.length > 20);
    for (const token of sentTokens) {
      for (const segment of token.split('.').filter((s) => s.length > 16)) assert.ok(!log.includes(segment), 'token material leaked');
    }
  });
});

describe('JWKS rotation and availability', () => {
  let db: TestDb;
  before(async () => {
    db = await createTestDb();
  });
  after(async () => {
    await db.drop();
  });

  test('rotated keys verify after a refetch and retired keys stop working', async () => {
    const oldKey = await signingKey('2026-a');
    const newKey = await signingKey('2026-b');
    const idp = await startIdp([oldKey]);
    const app = buildApp({ pool: db.pool, auth: { issuer, audience, jwksUrl: idp.url, jwksCooldownMs: 0 } });
    try {
      assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(oldKey)) })).statusCode, 200);
      idp.keys = [newKey];
      assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(newKey)) })).statusCode, 200);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(oldKey)) })).statusCode, 401);
    } finally {
      await app.close();
      await idp.close();
    }
  });

  test('unknown kids do not trigger a JWKS refetch inside the cooldown', async () => {
    const key = await signingKey('cooldown');
    const idp = await startIdp([key]);
    const app = buildApp({ pool: db.pool, auth: { issuer, audience, jwksUrl: idp.url, jwksCooldownMs: 60_000 } });
    try {
      assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(key)) })).statusCode, 200);
      const fetches = idp.fetches;
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(await signingKey(`junk-${i}`))) });
        assert.equal(res.statusCode, 401);
      }
      assert.equal(idp.fetches, fetches);
    } finally {
      await app.close();
      await idp.close();
    }
  });

  test('an unavailable JWKS yields 503, never a pass', async () => {
    const key = await signingKey('down');
    const idp = await startIdp([key]);
    idp.status = 500;
    const app = buildApp({ pool: db.pool, auth: { issuer, audience, jwksUrl: idp.url } });
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(key)) });
      assert.equal(res.statusCode, 503);
      assert.equal(res.json().code, 'auth_unavailable');
      assertMatchesContract('get', '/v1/me', 503, res.json());
      await idp.close();
      const refused = buildApp({ pool: db.pool, auth: { issuer, audience, jwksUrl: idp.url } });
      const res2 = await refused.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(key)) });
      await refused.close();
      assert.equal(res2.statusCode, 503);
    } finally {
      await app.close();
    }
  });

  test('last good keys keep serving through a bounded provider outage', async () => {
    const key = await signingKey('outage');
    const junk = await signingKey('junk-during-outage');
    const idp = await startIdp([key]);
    const auth = { issuer, audience, jwksUrl: idp.url, jwksCacheMaxAgeMs: 50, jwksStaleMaxMs: 2_000, jwksRetryAfterFailureMs: 10_000 };
    const app = buildApp({ pool: db.pool, auth });
    const call = async (k: SigningKey) => (await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(k)) })).statusCode;
    try {
      assert.equal(await call(key), 200);
      idp.status = 500;
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await call(key), 200, 'cached keys must survive a refetch failure');
      const fetches = idp.fetches;
      assert.equal(await call(junk), 401, 'unknown kid stays 401 during an outage');
      assert.equal(idp.fetches, fetches, 'no refetch storm right after a failure');
      await new Promise((resolve) => setTimeout(resolve, 2_100));
      assert.equal(await call(key), 503, 'stale keys expire after jwksStaleMaxMs');
    } finally {
      await app.close();
      await idp.close();
    }
  });

  test('the outage fallback includes keys learned from the latest rotation', async () => {
    const oldKey = await signingKey('rotate-old');
    const newKey = await signingKey('rotate-new');
    const idp = await startIdp([oldKey]);
    const auth = { issuer, audience, jwksUrl: idp.url, jwksCooldownMs: 0, jwksCacheMaxAgeMs: 50, jwksRetryAfterFailureMs: 10_000 };
    const app = buildApp({ pool: db.pool, auth });
    const call = async (k: SigningKey) => (await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(k)) })).statusCode;
    try {
      assert.equal(await call(oldKey), 200);
      idp.keys = [newKey];
      assert.equal(await call(newKey), 200);
      idp.status = 500;
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await call(newKey), 200, 'rotated key must be in the fallback set');
      assert.equal(await call(oldKey), 401, 'retired key must not come back from the fallback set');
    } finally {
      await app.close();
      await idp.close();
    }
  });

  test('a configured token type rejects other token types', async () => {
    const key = await signingKey('typed');
    const idp = await startIdp([key]);
    const app = buildApp({ pool: db.pool, auth: { issuer, audience, jwksUrl: idp.url, tokenType: 'at+jwt' } });
    try {
      const idToken = await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(key, { nonce: 'n' }, 'JWT')) });
      assert.equal(idToken.statusCode, 401);
      const accessToken = await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(await mint(key, {}, 'at+jwt')) });
      assert.equal(accessToken.statusCode, 200);
    } finally {
      await app.close();
      await idp.close();
    }
  });

  test('protected routes fail closed when auth is not configured', async () => {
    const app = buildApp({ pool: db.pool });
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/me' });
      assert.equal(res.statusCode, 503);
      assert.equal(res.json().code, 'auth_not_configured');
    } finally {
      await app.close();
    }
  });
});

test('auth configuration is all-or-nothing and requires https outside loopback', () => {
  const base = { DATABASE_URL: 'postgres://x@localhost/x' };
  assert.equal(loadConfig(base).auth, undefined);
  assert.equal(loadConfig(base).trustProxy, false);
  assert.deepEqual(loadConfig({ ...base, TRUST_PROXY: '10.0.0.0/8, 192.168.1.1' }).trustProxy, ['10.0.0.0/8', '192.168.1.1']);
  const hops = loadConfig({ ...base, TRUST_PROXY: '1' }).trustProxy as (address: string, hop: number) => boolean;
  assert.equal(hops('10.0.0.1', 0), true);
  assert.equal(hops('10.0.0.1', 1), false);
  assert.throws(() => loadConfig({ ...base, TRUST_PROXY: 'true' }), /TRUST_PROXY/);
  assert.throws(() => loadConfig({ ...base, AUTH_ISSUER: issuer }), /set together/);
  assert.throws(() => loadConfig({ ...base, AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: 'https://idp.example.com/jwks' }), /AUTH_LOG_SALT/);
  const full = { ...base, AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_LOG_SALT: 's'.repeat(32), AUTH_TOKEN_TYPE: 'at+jwt' };
  assert.equal(loadConfig({ ...full, AUTH_JWKS_URL: 'https://idp.example.com/jwks' }).auth?.tokenType, 'at+jwt');
  assert.equal(loadConfig({ ...full, AUTH_JWKS_URL: 'https://idp.example.com/jwks', AUTH_MAX_TOKEN_LIFETIME: '86400' }).auth?.maxTokenLifetimeSeconds, 86400);
  assert.throws(() => loadConfig({ ...full, AUTH_JWKS_URL: 'https://idp.example.com/jwks', AUTH_MAX_TOKEN_LIFETIME: '1e9' }), /AUTH_MAX_TOKEN_LIFETIME/);
  assert.throws(() => loadConfig({ ...full, AUTH_JWKS_URL: 'http://idp.example.com/jwks' }), /https/);
  assert.equal(loadConfig({ ...full, AUTH_JWKS_URL: 'http://127.0.0.1:9/jwks' }).auth?.jwksUrl, 'http://127.0.0.1:9/jwks');
  assert.equal(loadConfig({ ...full, AUTH_JWKS_URL: 'https://idp.example.com/jwks' }).auth?.issuer, issuer);
});
