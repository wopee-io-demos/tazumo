import test from 'node:test';
import assert from 'node:assert/strict';
import { cartKey, lineKey, lineTestKey, parseCartKey, priceCartLines, priceSelection, type CartProduct } from './index.ts';
import { syntheticOptionsFor } from './fixtures.ts';

const eur = (minorUnits: number) => ({ currency: 'EUR', minorUnits });
const pizza: CartProduct = { id: 'pizza', basePrice: eur(1190), options: syntheticOptionsFor('pizza') };
const burger: CartProduct = { id: 'burger', basePrice: eur(1390), options: syntheticOptionsFor('burger') };
const bread: CartProduct = { id: 'bread', basePrice: eur(450) };
const catalogue = new Map([pizza, burger, bread].map((p) => [p.id, p]));
const find = (id: string) => catalogue.get(id);

test('the default configuration and a product without options keep the product ID as key', () => {
  assert.equal(cartKey(pizza, { size: ['medium'], extras: [] }), 'pizza');
  assert.equal(cartKey(bread, {}), 'bread');
  assert.equal(lineTestKey(pizza, { size: ['medium'], extras: [] }), 'pizza');
});

test('any other configuration is keyed by lineKey and gets a readable test key', () => {
  const selection = { size: ['large'], extras: ['olives', 'mushrooms'] };
  assert.equal(cartKey(pizza, selection), lineKey('pizza', selection));
  assert.equal(lineTestKey(pizza, selection), 'pizza-large-olives-mushrooms');
  assert.equal(lineTestKey(burger, { sauce: [], toppings: [] }), 'burger-none');
});

test('a product whose defaults do not resolve is always keyed by lineKey', () => {
  const noDefault: CartProduct = { ...pizza, id: 'nodefault', options: { ...pizza.options!, productId: 'nodefault', groups: pizza.options!.groups.map((g) => ({ ...g, options: g.options.map((o) => ({ ...o, isDefault: false })) })) } };
  assert.equal(cartKey(noDefault, { size: ['medium'], extras: [] }), lineKey('nodefault', { size: ['medium'], extras: [] }));
});

test('parseCartKey inverts cartKey and rejects malformed keys', () => {
  assert.deepEqual(parseCartKey('pizza'), { productId: 'pizza' });
  const selection = { size: ['large'], extras: ['olives'] };
  assert.deepEqual(parseCartKey(cartKey(pizza, selection)), { productId: 'pizza', selection: { extras: ['olives'], size: ['large'] } });
  for (const bad of ['', '[', '["pizza"]', '[1,[]]', '["pizza",{}]', '["pizza",[["size","large"]]]', '["pizza",[[1,[]]]]', '["pizza",[["size",[1]]]]', '["pizza",["size"]]']) {
    assert.equal(parseCartKey(bad), undefined, bad);
  }
});

test('priceCartLines prices two configurations of one product as separate lines, in cart order', () => {
  const large = { size: ['large'], extras: ['olives', 'mushrooms'] };
  const cart = { pizza: 1, [cartKey(pizza, large)]: 2, bread: 3 };
  const lines = priceCartLines(cart, find);
  assert.deepEqual(lines.map((l) => [l.testKey, l.unitPrice.minorUnits, l.lineTotal.minorUnits]), [
    ['pizza', 1190, 1190],
    ['pizza-large-olives-mushrooms', 1720, 3440],
    ['bread', 450, 1350]
  ]);
  const expected = priceSelection(pizza.options!, pizza.basePrice, large, 2);
  assert.ok(expected.ok);
  assert.deepEqual(lines[1].unitPrice, expected.unitPrice);
  assert.equal(lines[1].lineKey, lineKey('pizza', expected.selection));
  assert.equal(lines[0].lineKey, lineKey('pizza', { size: ['medium'], extras: [] }));
});

test('priceCartLines does not cap quantities but drops non-integer or unsafe totals', () => {
  assert.deepEqual(priceCartLines({ bread: 1000 }, find).map((l) => [l.quantity, l.lineTotal.minorUnits]), [[1000, 450_000]]);
  assert.deepEqual(priceCartLines({ bread: 1.5, pizza: Number.MAX_SAFE_INTEGER }, find), []);
});

test('priceCartLines leaves out empty, malformed, unknown, non-canonical and invalid entries', () => {
  const cart = {
    pizza: 0,
    '[': 1,
    headphones: 1,
    [lineKey('pizza', { size: ['medium'], extras: [] })]: 1,
    [lineKey('pizza', { size: ['large'], extras: ['truffle'] })]: 1,
    [lineKey('bread', { size: ['large'] })]: 1
  };
  assert.deepEqual(priceCartLines(cart, find), []);
});

test('test keys are unique across every valid fixture configuration and fit the sut-* ID pattern', async () => {
  const { syntheticProductOptions } = await import('./fixtures.ts');
  const subsets = <T,>(items: T[]): T[][] => items.reduce<T[][]>((all, item) => [...all, ...all.map((s) => [...s, item])], [[]]);
  const seen = new Set<string>();
  for (const def of syntheticProductOptions) {
    const product: CartProduct = { id: def.productId, basePrice: eur(1000), options: def };
    const perGroup = def.groups.map((g) => subsets(g.options.filter((o) => o.available).map((o) => o.id)).filter((s) => s.length >= g.min && s.length <= g.max));
    const combos = perGroup.reduce<string[][][]>((all, choices) => all.flatMap((c) => choices.map((s) => [...c, s])), [[]]);
    for (const combo of combos) {
      const selection = Object.fromEntries(def.groups.map((g, i) => [g.id, combo[i]]));
      const key = lineTestKey(product, selection);
      assert.match(key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(!seen.has(key), key);
      seen.add(key);
    }
  }
  assert.ok(seen.size > 50);
});
