import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { getMarket, priceBreakdown } from '@tazumo/commerce';
import { buildApp } from '../src/app.ts';
import { uuidV5 } from '../src/fixtures.ts';
import { syntheticDistanceMeters } from '../src/routes/quotes.ts';
import { seed } from '../src/seed.ts';
import { assertMatchesContract, createTestDb, type TestDb } from './helpers.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sk = { merchant: id(101), pizza: id(201), bread: id(202), headphones: id(203), unavailable: id(204), wrongCurrency: id(205) };
const cz = { merchant: id(102), dumplings: id(301) };
const postal = (predicate: (meters: number) => boolean) => {
  for (let code = 10000; code < 99999; code++) if (predicate(syntheticDistanceMeters(String(code)))) return String(code);
  throw new Error('no postal code found');
};
const near = postal((m) => m <= 2000);
const far = postal((m) => m > 7000);
const address = (countryCode: string, postalCode = near) => ({ countryCode, postalCode, addressLine1: 'Synthetic street 1', city: 'Synthetic' });
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('POST /v1/order-quotes on @tazumo/commerce', () => {
  let db: TestDb;
  let app: ReturnType<typeof buildApp>;
  const logLines: string[] = [];

  before(async () => {
    db = await createTestDb();
    await seed(db.pool);
    await db.pool.query(`INSERT INTO markets VALUES ('bratislava', 'SK', 'EUR', 'sk-SK'), ('praha', 'CZ', 'CZK', 'cs-CZ')`);
    await db.pool.query(
      `INSERT INTO merchants (id, slug, market_code, name) VALUES ($1, 'sk-shop', 'bratislava', 'SK shop'), ($2, 'cz-shop', 'praha', 'CZ shop')`,
      [sk.merchant, cz.merchant]
    );
    const insert = `INSERT INTO products (id, slug, merchant_id, category_code, vat_category, name, price_minor, currency, available)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
    await db.pool.query(insert, [sk.pizza, 'sk-pizza', sk.merchant, 'food', 'food', 'Pizza', 1190, 'EUR', true]);
    await db.pool.query(insert, [sk.bread, 'sk-bread', sk.merchant, 'groceries', 'groceries', 'Bread', 450, 'EUR', true]);
    await db.pool.query(insert, [sk.headphones, 'sk-headphones', sk.merchant, 'shops', 'electronics', 'Headphones', 3990, 'EUR', true]);
    await db.pool.query(insert, [sk.unavailable, 'sk-unavailable', sk.merchant, 'food', 'food', 'Sold out', 500, 'EUR', false]);
    await db.pool.query(insert, [sk.wrongCurrency, 'sk-wrong', sk.merchant, 'food', 'food', 'Bad data', 500, 'CZK', true]);
    await db.pool.query(insert, [cz.dumplings, 'cz-dumplings', cz.merchant, 'food', 'food', 'Knedliky', 12345, 'CZK', true]);
    const stream = new Writable({ write: (chunk, _e, done) => (logLines.push(chunk.toString()), done()) });
    app = buildApp({ pool: db.pool, logger: { level: 'info', stream } });
    await app.ready();
  });
  after(async () => {
    await app.close();
    await db.drop();
  });

  const quote = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/v1/order-quotes', payload });
  const skBasket = (extra: Record<string, unknown> = {}) => ({
    marketCode: 'bratislava',
    merchantId: sk.merchant,
    items: [
      { productId: sk.pizza, quantity: 2 },
      { productId: sk.bread, quantity: 1 },
      { productId: sk.headphones, quantity: 1 }
    ],
    deliveryAddress: address('SK'),
    ...extra
  });

  test('SK basket: VAT per rate, components sum to payable, matches the commerce package exactly', async () => {
    const res = await quote(skBasket());
    assert.equal(res.statusCode, 200, res.body);
    const q = res.json();
    assertMatchesContract('post', '/v1/order-quotes', 200, q);
    const expected = priceBreakdown(getMarket('SK'), {
      lines: [
        { id: sk.pizza, quantity: 2, unitPrice: { currency: 'EUR', minorUnits: 1190 }, vatCategory: 'food' },
        { id: sk.bread, quantity: 1, unitPrice: { currency: 'EUR', minorUnits: 450 }, vatCategory: 'groceries' },
        { id: sk.headphones, quantity: 1, unitPrice: { currency: 'EUR', minorUnits: 3990 }, vatCategory: 'electronics' }
      ],
      deliveryDistanceMeters: syntheticDistanceMeters(near)
    });
    assert.equal(q.total.minorUnits, expected.totalMinor);
    assert.equal(q.payable.minorUnits, expected.payableMinor);
    assert.ok(new Set(q.vat.map((g: { rateId: string }) => g.rateId)).size >= 2, 'mixed rates produce several VAT groups');
    assert.equal(q.tax.minorUnits, sum(q.vat.map((g: { vat: { minorUnits: number } }) => g.vat.minorUnits)));
    assert.equal(q.total.minorUnits, sum(q.vat.map((g: { gross: { minorUnits: number } }) => g.gross.minorUnits)));
    const payable = sum(q.components.filter((c: { addsToPayable: boolean }) => c.addsToPayable).map((c: { amount: { minorUnits: number } }) => c.amount.minorUnits));
    assert.equal(payable, q.payable.minorUnits);
    assert.equal(q.payable.minorUnits, q.total.minorUnits, 'card payments are not rounded');
    for (const kind of ['delivery_fee', 'small_order_surcharge']) {
      assert.equal(q.components.find((c: { kind: string }) => c.kind === kind).synthetic, true, `${kind} is synthetic`);
    }
    assert.equal(q.deliveryDistance.synthetic, true);
    assert.equal(q.dataStatus.feesSynthetic, true);
    assert.equal(q.dataStatus.redeemable, false);
    assert.match(q.dataStatus.notice, /synthetic/);
    assert.equal(q.itemsAvailable, true);
  });

  test('CZK cash quote: payable in whole crowns with a rounding component, total stays exact', async () => {
    const payload = { marketCode: 'praha', merchantId: cz.merchant, items: [{ productId: cz.dumplings, quantity: 1 }], deliveryAddress: address('CZ') };
    const cash = (await quote({ ...payload, paymentMethod: 'cash' })).json();
    assertMatchesContract('post', '/v1/order-quotes', 200, cash);
    assert.equal(cash.payable.currency, 'CZK');
    assert.equal(cash.payable.minorUnits % 100, 0);
    assert.notEqual(cash.total.minorUnits % 100, 0, 'fixture total has halers');
    assert.equal(cash.payable.minorUnits - cash.total.minorUnits, cash.rounding.minorUnits);
    assert.ok(cash.components.some((c: { kind: string }) => c.kind === 'rounding'));
    const card = (await quote(payload)).json();
    assert.equal(card.paymentMethod, 'card');
    assert.equal(card.total.minorUnits, cash.total.minorUnits);
    assert.equal(card.payable.minorUnits, card.total.minorUnits);
    assert.equal(card.rounding.minorUnits, 0);
  });

  test('client-supplied prices are never used', async () => {
    const basket = skBasket();
    const honest = (await quote(basket)).json();
    const tampered = await quote({
      ...basket,
      items: basket.items.map((item) => ({ ...item, unitPrice: { currency: 'EUR', minorUnits: 1 }, vatCategory: 'groceries' }))
    });
    assert.ok([200, 400].includes(tampered.statusCode));
    if (tampered.statusCode === 200) assert.equal(tampered.json().total.minorUnits, honest.total.minorUnits);
  });

  const rejected: Array<[string, () => Record<string, unknown>, number, string]> = [
    ['unknown product', () => skBasket({ items: [{ productId: id(999), quantity: 1 }] }), 404, 'product_not_found'],
    ['product of another merchant', () => skBasket({ items: [{ productId: cz.dumplings, quantity: 1 }] }), 404, 'product_not_found'],
    ['unknown market', () => skBasket({ marketCode: 'atlantis' }), 404, 'market_not_found'],
    ['merchant outside the market', () => skBasket({ merchantId: cz.merchant }), 404, 'merchant_not_found'],
    ['quantity 0', () => skBasket({ items: [{ productId: sk.pizza, quantity: 0 }] }), 400, 'invalid_request'],
    ['quantity above the contract cap', () => skBasket({ items: [{ productId: sk.pizza, quantity: 101 }] }), 400, 'invalid_request'],
    ['more than 100 lines', () => skBasket({ items: Array.from({ length: 101 }, (_, i) => ({ productId: id(1000 + i), quantity: 1 })) }), 400, 'invalid_request'],
    ['empty basket', () => skBasket({ items: [] }), 400, 'invalid_request'],
    ['duplicate line', () => skBasket({ items: [{ productId: sk.pizza, quantity: 1 }, { productId: sk.pizza, quantity: 2 }] }), 400, 'duplicate_line'],
    ['distance beyond the last band', () => skBasket({ deliveryAddress: address('SK', far) }), 422, 'outside_delivery_area'],
    ['address in another country', () => skBasket({ deliveryAddress: address('AT') }), 422, 'outside_delivery_area'],
    [
      'seeded IE demo market',
      () => ({ marketCode: 'demo-eu', merchantId: uuidV5('merchant:Piazza Local'), items: [{ productId: uuidV5('product:pizza'), quantity: 1 }], deliveryAddress: address('IE') }),
      422,
      'unsupported_market'
    ]
  ];
  for (const [name, payload, status, code] of rejected) {
    test(`rejects ${name} with ${status} ${code}`, async () => {
      const res = await quote(payload());
      assert.equal(res.statusCode, status, res.body);
      assert.equal(res.json().code, code);
      assertMatchesContract('post', '/v1/order-quotes', status, res.json());
    });
  }

  test('unavailable products are flagged', async () => {
    const q = (await quote(skBasket({ items: [{ productId: sk.unavailable, quantity: 1 }] }))).json();
    assert.equal(q.itemsAvailable, false);
    assert.deepEqual(q.unavailableProductIds, [sk.unavailable]);
  });

  test('bad server data is a 500 logged by code, without customer data', async () => {
    logLines.length = 0;
    const res = await quote(skBasket({ items: [{ productId: sk.wrongCurrency, quantity: 1 }] }));
    assert.equal(res.statusCode, 500);
    assert.equal(res.json().message, 'Internal server error');
    const log = logLines.join('');
    assert.match(log, /"commerceError":"currency_mismatch"/);
    assert.ok(!log.includes('Synthetic street') && !log.includes(near), 'no address data in logs');
  });

  test('synthetic distance is deterministic and ignores spacing and case', () => {
    assert.equal(syntheticDistanceMeters('811 01'), syntheticDistanceMeters('81101'));
    assert.equal(syntheticDistanceMeters('ab1 2cd'), syntheticDistanceMeters('AB12CD'));
    assert.ok(syntheticDistanceMeters(near) <= 2000 && syntheticDistanceMeters(far) > 7000);
  });
});
