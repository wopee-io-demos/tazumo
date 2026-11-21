import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getMarket, priceBreakdown } from '@tazumo/commerce';
import { priceSelection, validateOptionGroups, type OptionGroup } from '@tazumo/product-options';
import { buildApp } from '../src/app.ts';
import { syntheticDistanceMeters } from '../src/routes/quotes.ts';
import { assertMatchesContract, createAppRolePool, createTestDb, type TestDb } from './helpers.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const merchant = id(501);
const pizza = id(601);
const bread = id(602);
const salad = id(603);
const broken = id(604);
const postalCode = (() => {
  for (let code = 10000; code <= 99999; code++) if (syntheticDistanceMeters(String(code)) <= 2000) return String(code);
  throw new Error('no postal code found');
})();
const past = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 86_400_000).toISOString();

describe('product options in the catalogue and the quote', () => {
  let db: TestDb;
  let app: ReturnType<typeof buildApp>;

  before(async () => {
    db = await createTestDb();
    await db.pool.query(`INSERT INTO markets VALUES ('bratislava', 'SK', 'EUR', 'sk-SK')`);
    await db.pool.query(`INSERT INTO catalogue_categories VALUES ('food', 'Food', 0), ('groceries', 'Groceries', 1)`);
    await db.pool.query(`INSERT INTO merchants (id, slug, market_code, name) VALUES ($1, 'opt-shop', 'bratislava', 'Options shop')`, [merchant]);
    const product = `INSERT INTO products (id, slug, merchant_id, category_code, vat_category, name, price_minor, currency, available)
                     VALUES ($1, $2, $3, $4, $4, $5, $6, 'EUR', true)`;
    await db.pool.query(product, [pizza, 'opt-pizza', merchant, 'food', 'Pizza', 1190]);
    await db.pool.query(product, [bread, 'opt-bread', merchant, 'groceries', 'Bread', 450]);
    await db.pool.query(product, [salad, 'opt-salad', merchant, 'food', 'Salad', 800]);
    await db.pool.query(product, [broken, 'opt-broken', merchant, 'food', 'Broken', 500]);
    const group = `INSERT INTO product_option_groups (product_id, id, label_key, selection, min_choices, max_choices, required, sort_order)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    await db.pool.query(group, [pizza, 'size', 'options.size', 'single', 1, 1, true, 0]);
    await db.pool.query(group, [pizza, 'extras', 'options.extras', 'multiple', 0, 2, false, 1]);
    await db.pool.query(group, [salad, 'dressing', 'options.dressing', 'single', 1, 1, true, 0]);
    await db.pool.query(group, [broken, 'empty', 'options.empty', 'single', 0, 1, false, 0]);
    const option = `INSERT INTO product_options (product_id, group_id, id, label_key, price_delta_minor, availability, is_default, sort_order)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    const rows: Array<[string, string, string, number, object, boolean]> = [
      [pizza, 'size', 'small', -200, { status: 'in_stock' }, false],
      [pizza, 'size', 'medium', 0, { status: 'in_stock' }, true],
      [pizza, 'size', 'large', 350, { status: 'in_stock' }, false],
      [pizza, 'extras', 'olives', 90, { status: 'in_stock' }, false],
      [pizza, 'extras', 'mushrooms', 90, { status: 'in_stock' }, false],
      [pizza, 'extras', 'chilli-oil', 60, { status: 'scheduled', from: past }, false],
      [pizza, 'extras', 'basil', 30, { status: 'scheduled', from: future }, false],
      [pizza, 'extras', 'truffle', 400, { status: 'out_of_stock' }, false],
      [salad, 'dressing', 'lemon', 0, { status: 'in_stock' }, false]
    ];
    for (const [order, [productId, groupId, optionId, delta, availability, isDefault]] of rows.entries()) {
      await db.pool.query(option, [productId, groupId, optionId, `options.${optionId}`, delta, availability, isDefault, order]);
    }
    app = buildApp({ pool: db.pool });
    await app.ready();
  });
  after(async () => {
    await app.close();
    await db.drop();
  });

  const quote = (items: unknown[]) =>
    app.inject({
      method: 'POST',
      url: '/v1/order-quotes',
      payload: { marketCode: 'bratislava', merchantId: merchant, items, deliveryAddress: { countryCode: 'SK', postalCode, addressLine1: 'Synthetic street 1', city: 'Synthetic' } }
    });
  const products = async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/merchants/${merchant}/products` });
    assert.equal(res.statusCode, 200, res.body);
    assertMatchesContract('get', '/v1/merchants/{merchantId}/products', 200, res.json());
    return new Map<string, { optionGroups?: OptionGroup[] }>(res.json().map((p: { id: string }) => [p.id, p]));
  };

  test('catalogue returns option groups with availability resolved now; products without options omit them', async () => {
    const byId = await products();
    const groups = byId.get(pizza)!.optionGroups!;
    assert.deepEqual(validateOptionGroups({ productId: pizza, currency: 'EUR', groups }), []);
    assert.deepEqual(groups.map((g) => g.id), ['size', 'extras']);
    const extras = Object.fromEntries(groups[1].options.map((o) => [o.id, o.available]));
    assert.deepEqual(extras, { olives: true, mushrooms: true, 'chilli-oil': true, basil: false, truffle: false });
    assert.equal(groups[0].options.find((o) => o.id === 'small')!.priceDeltaMinor, -200);
    assert.equal('optionGroups' in byId.get(bread)!, false);
  });

  test('defaults apply when no options are sent, and the line snapshot matches the contract', async () => {
    const res = await quote([{ productId: pizza, quantity: 1 }]);
    assert.equal(res.statusCode, 200, res.body);
    const q = res.json();
    assertMatchesContract('post', '/v1/order-quotes', 200, q);
    assert.deepEqual(q.lines, [
      {
        productId: pizza,
        quantity: 1,
        selectedOptions: { size: ['medium'], extras: [] },
        options: [{ groupId: 'size', optionId: 'medium', labelKey: 'options.medium', priceDeltaMinor: 0 }],
        basePrice: { currency: 'EUR', minorUnits: 1190 },
        unitPrice: { currency: 'EUR', minorUnits: 1190 },
        lineTotal: { currency: 'EUR', minorUnits: 1190 }
      }
    ]);
  });

  test('chosen options price exactly as the package and the commerce totals use that unit price', async () => {
    const selectedOptions = { size: ['large'], extras: ['olives', 'chilli-oil'] };
    const res = await quote([{ productId: pizza, quantity: 2, selectedOptions }]);
    assert.equal(res.statusCode, 200, res.body);
    const q = res.json();
    const groups = (await products()).get(pizza)!.optionGroups!;
    const expected = priceSelection({ productId: pizza, currency: 'EUR', groups }, { currency: 'EUR', minorUnits: 1190 }, selectedOptions, 2);
    assert.ok(expected.ok);
    assert.equal(expected.unitPrice.minorUnits, 1190 + 350 + 90 + 60);
    assert.deepEqual(q.lines[0].unitPrice, expected.unitPrice);
    assert.deepEqual(q.lines[0].lineTotal, expected.lineTotal);
    const breakdown = priceBreakdown(getMarket('SK'), {
      lines: [{ id: 'pizza', quantity: 2, unitPrice: expected.unitPrice, vatCategory: 'food' }],
      deliveryDistanceMeters: syntheticDistanceMeters(postalCode)
    });
    assert.equal(q.subtotal.minorUnits, breakdown.subtotalMinor);
    assert.equal(q.total.minorUnits, breakdown.totalMinor);
  });

  test('two configurations of one product are separate lines next to a product without options', async () => {
    const res = await quote([
      { productId: pizza, quantity: 1, selectedOptions: { size: ['small'] } },
      { productId: bread, quantity: 3 },
      { productId: pizza, quantity: 2, selectedOptions: { size: ['large'], extras: ['mushrooms'] } }
    ]);
    assert.equal(res.statusCode, 200, res.body);
    const q = res.json();
    assertMatchesContract('post', '/v1/order-quotes', 200, q);
    assert.deepEqual(
      q.lines.map((l: { productId: string; unitPrice: { minorUnits: number } }) => [l.productId, l.unitPrice.minorUnits]),
      [[pizza, 990], [bread, 450], [pizza, 1630]]
    );
    assert.deepEqual(q.lines[1].selectedOptions, {});
    assert.equal(q.subtotal.minorUnits, 990 + 3 * 450 + 2 * 1630);
  });

  const invalid: Array<[string, unknown[], number, string, string[]]> = [
    ['an unknown group', [{ productId: pizza, quantity: 1, selectedOptions: { crust: ['thin'] } }], 400, 'invalid_options', ['unknown_group']],
    ['an unknown option', [{ productId: pizza, quantity: 1, selectedOptions: { size: ['huge'] } }], 400, 'invalid_options', ['unknown_option']],
    ['an option from another group', [{ productId: pizza, quantity: 1, selectedOptions: { size: ['olives'] } }], 400, 'invalid_options', ['option_wrong_group']],
    ['a duplicate option', [{ productId: pizza, quantity: 1, selectedOptions: { extras: ['olives', 'olives'] } }], 400, 'invalid_options', ['duplicate_option']],
    [
      'too many options',
      [{ productId: pizza, quantity: 1, selectedOptions: { extras: ['olives', 'mushrooms', 'chilli-oil'] } }],
      400,
      'invalid_options',
      ['too_many_options']
    ],
    ['none for a required group', [{ productId: pizza, quantity: 1, selectedOptions: { size: [] } }], 400, 'invalid_options', ['too_few_options']],
    ['a required group without a default left out', [{ productId: salad, quantity: 1 }], 400, 'invalid_options', ['missing_required_group']],
    ['options on a product without options', [{ productId: bread, quantity: 1, selectedOptions: { size: ['large'] } }], 400, 'invalid_options', ['unknown_group']],
    ['an out-of-stock option', [{ productId: pizza, quantity: 1, selectedOptions: { extras: ['truffle'] } }], 409, 'option_unavailable', ['option_unavailable']],
    ['an option scheduled later', [{ productId: pizza, quantity: 1, selectedOptions: { extras: ['basil'] } }], 409, 'option_unavailable', ['option_unavailable']]
  ];
  for (const [name, items, status, code, errorCodes] of invalid) {
    test(`rejects ${name} with ${status} ${code}`, async () => {
      const res = await quote(items);
      assert.equal(res.statusCode, status, res.body);
      const body = res.json();
      assertMatchesContract('post', '/v1/order-quotes', status, body);
      assert.equal(body.code, code);
      const codes = body.details.errors.map((e: { code: string }) => e.code);
      for (const expected of errorCodes) assert.ok(codes.includes(expected), `${expected} in ${codes}`);
      assert.ok(body.details.errors.every((e: { path: unknown[] }) => Array.isArray(e.path) && e.path.length > 0));
    });
  }

  test('the same product with the same resolved options twice is a duplicate line', async () => {
    const res = await quote([
      { productId: pizza, quantity: 1 },
      { productId: pizza, quantity: 1, selectedOptions: { size: ['medium'], extras: [] } }
    ]);
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, 'duplicate_line');
    assert.doesNotMatch(res.json().message, /\[/);
  });

  const malformed: Array<[string, unknown]> = [
    ['an object instead of an option ID', { size: [{ id: 'large' }] }],
    ['an ID outside the pattern', { size: ['LARGE'] }],
    ['a group key outside the pattern', { 'Size Group': ['large'] }],
    ['more than 20 groups', Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`g${i}`, []]))]
  ];
  for (const [name, selectedOptions] of malformed) {
    test(`schema rejects ${name}`, async () => {
      const res = await quote([{ productId: pizza, quantity: 1, selectedOptions }]);
      assert.equal(res.statusCode, 400, res.body);
      assert.equal(res.json().code, 'invalid_request');
    });
  }

  test('a client-supplied price never reaches the quote', async () => {
    const res = await quote([{ productId: pizza, quantity: 1, selectedOptions: { size: ['large'] }, unitPrice: { currency: 'EUR', minorUnits: 1 } }]);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().lines[0].unitPrice.minorUnits, 1190 + 350);
  });

  test('a broken catalogue definition is a 500 that leaks no detail', async () => {
    const res = await quote([{ productId: broken, quantity: 1 }]);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(Object.keys(res.json()).sort(), ['code', 'message', 'requestId']);
    assert.equal(res.json().code, 'internal_error');
  });

  test('the tazumo_api role reads options but cannot change them', async () => {
    const role = await createAppRolePool(db);
    try {
      const { rows } = await role.pool.query('SELECT count(*)::int AS n FROM product_options WHERE product_id = $1', [pizza]);
      assert.equal(rows[0].n, 8);
      await assert.rejects(role.pool.query(`UPDATE product_options SET price_delta_minor = 0`), /permission denied/);
      await assert.rejects(role.pool.query(`DELETE FROM product_option_groups`), /permission denied/);
    } finally {
      await role.drop();
    }
  });

  test('database constraints reject malformed groups and options', async () => {
    const group = (values: unknown[]) =>
      db.pool.query(
        `INSERT INTO product_option_groups (product_id, id, label_key, selection, min_choices, max_choices, required) VALUES ($1, $2, 'k', $3, $4, $5, $6)`,
        values
      );
    await assert.rejects(group([bread, 'Bad ID', 'single', 0, 1, false]), /check constraint/);
    await assert.rejects(group([bread, 'g1', 'single', 0, 2, false]), /check constraint/);
    await assert.rejects(group([bread, 'g2', 'multiple', 3, 2, true]), /check constraint/);
    await assert.rejects(group([bread, 'g3', 'single', 1, 1, false]), /check constraint/);
    const option = (values: unknown[]) =>
      db.pool.query(`INSERT INTO product_options (product_id, group_id, id, label_key, price_delta_minor, availability) VALUES ($1, $2, $3, 'k', $4, $5)`, values);
    await assert.rejects(option([pizza, 'size', 'tiny', 10.5, { status: 'in_stock' }]), /invalid input syntax for type integer/);
    await assert.rejects(option([pizza, 'size', 'tiny', 10, { status: 'maybe' }]), /check constraint/);
    await assert.rejects(option([bread, 'size', 'tiny', 10, { status: 'in_stock' }]), /foreign key/);
    await assert.rejects(option([pizza, 'extras', 'small', 10, { status: 'in_stock' }]), /duplicate key/);
  });
});
