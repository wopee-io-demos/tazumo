import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { contract, toFastifyPath } from '../src/contract.ts';
import { uuidV5 } from '../src/fixtures.ts';
import { seed } from '../src/seed.ts';
import { assertMatchesContract, createTestDb, type TestDb } from './helpers.ts';

describe('catalogue API against PostgreSQL', () => {
  let db: TestDb;
  let app: ReturnType<typeof buildApp>;
  const pizzaMerchant = uuidV5('merchant:piazza-local');

  before(async () => {
    db = await createTestDb();
    await seed(db.pool);
    app = buildApp({ pool: db.pool });
    await app.ready();
  });
  after(async () => {
    await app.close();
    await db.drop();
  });

  test('seed is idempotent', async () => {
    const counts = await seed(db.pool);
    const { rows } = await db.pool.query(
      `SELECT (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM merchants)::int AS merchants`
    );
    assert.deepEqual(rows[0], { products: counts.products, merchants: counts.merchants });
  });

  test('GET /v1/markets returns contract-valid markets', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/markets' });
    assert.equal(res.statusCode, 200);
    assertMatchesContract('get', '/v1/markets', 200, res.json());
    assert.deepEqual(res.json(), [{ code: 'demo', countryCode: 'IE', currency: 'EUR', locale: 'en-IE' }]);
  });

  test('GET /v1/merchants lists synthetic merchants that do not accept orders or promise ETAs', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/merchants?marketCode=demo' });
    assert.equal(res.statusCode, 200);
    const merchants = res.json();
    assertMatchesContract('get', '/v1/merchants', 200, merchants);
    assert.equal(merchants.length, 7);
    const piazza = merchants.find((m: { slug: string }) => m.slug === 'piazza-local');
    assert.deepEqual(piazza, {
      id: pizzaMerchant,
      slug: 'piazza-local',
      marketCode: 'demo',
      name: 'Piazza Local',
      categories: ['food'],
      acceptingOrders: false,
      deliveryEtaMinutes: null,
      synthetic: true
    });
    assert.ok(merchants.every((m: { acceptingOrders: boolean; synthetic: boolean }) => !m.acceptingOrders && m.synthetic));
  });

  test('GET /v1/merchants/{id}/products serves the pizza fixture in minor units', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/merchants/${pizzaMerchant}/products` });
    assert.equal(res.statusCode, 200);
    assertMatchesContract('get', '/v1/merchants/{merchantId}/products', 200, res.json());
    assert.deepEqual(res.json(), [
      {
        id: uuidV5('product:pizza'),
        slug: 'pizza',
        merchantId: pizzaMerchant,
        category: 'food',
        name: 'Margherita pizza',
        description: 'Tomato, mozzarella and basil',
        price: { currency: 'EUR', minorUnits: 1190 },
        available: true,
        synthetic: true
      }
    ]);
  });

  const rejected: Array<[string, string, number, string, string]> = [
    ['missing marketCode', '/v1/merchants', 400, 'invalid_request', '/v1/merchants'],
    ['injection-shaped marketCode', `/v1/merchants?marketCode=${encodeURIComponent("demo' OR 1=1--")}`, 400, 'invalid_request', '/v1/merchants'],
    ['oversized marketCode', `/v1/merchants?marketCode=${'a'.repeat(65)}`, 400, 'invalid_request', '/v1/merchants'],
    ['unknown market', '/v1/merchants?marketCode=atlantis', 400, 'unknown_market', '/v1/merchants'],
    ['malformed merchant ID', '/v1/merchants/pizza/products', 400, 'invalid_request', '/v1/merchants/{merchantId}/products'],
    [
      'unknown merchant',
      '/v1/merchants/00000000-0000-4000-8000-000000000000/products',
      404,
      'merchant_not_found',
      '/v1/merchants/{merchantId}/products'
    ]
  ];
  for (const [name, url, status, code, contractPath] of rejected) {
    test(`rejects ${name} with ${status} ${code}`, async () => {
      const res = await app.inject({ method: 'GET', url });
      assert.equal(res.statusCode, status);
      assert.equal(res.json().code, code);
      assert.equal(res.json().requestId, res.headers['x-request-id']);
      assertMatchesContract('get', contractPath, status, res.json());
    });
  }

  test('unknown routes return an ApiError 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nope' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, 'not_found');
  });

  test('every implemented /v1 route is declared in the contract', async () => {
    const declared = Object.entries(contract.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => `${method.toUpperCase()} ${toFastifyPath(path)}`)
    );
    const routes: string[] = [];
    const probe = buildApp({ pool: db.pool });
    probe.addHook('onRoute', (route) => {
      for (const method of [route.method].flat()) if (route.url.startsWith('/v1/') && method !== 'HEAD') routes.push(`${method} ${route.url}`);
    });
    await probe.ready();
    await probe.close();
    assert.equal(routes.length, 3);
    for (const route of routes) assert.ok(declared.includes(route), `${route} is not in contracts/openapi.json`);
  });
});
