import test from 'node:test';
import assert from 'node:assert/strict';
import { lineKey, priceSelection, syntheticOptionsFor } from './index.ts';
import type { Money, PricedSelection, ProductOptions } from './index.ts';

const pizza = syntheticOptionsFor('pizza')!;
const eur = (minorUnits: number): Money => ({ currency: 'EUR', minorUnits });
const priced = (...args: Parameters<typeof priceSelection>): PricedSelection => {
  const result = priceSelection(...args);
  assert.ok(result.ok, JSON.stringify(result));
  return result;
};
const errors = (...args: Parameters<typeof priceSelection>) => {
  const result = priceSelection(...args);
  assert.equal(result.ok, false);
  return result.ok ? [] : result.errors.map(({ code, path }) => ({ code, path }));
};

test('a required single group with a default prices with no explicit selection', () => {
  const result = priced(pizza, eur(1190), undefined, 1);
  assert.deepEqual(result.unitPrice, eur(1190));
  assert.deepEqual(result.lineTotal, eur(1190));
  assert.deepEqual(result.breakdown, [{ groupId: 'size', optionId: 'medium', labelKey: 'options.pizza.size.medium', priceDeltaMinor: 0 }]);
  assert.deepEqual(result.selection, { size: ['medium'], extras: [] });
});

test('sums multiple-choice deltas and multiplies by quantity in integers', () => {
  const result = priced(pizza, eur(1190), { size: ['large'], extras: ['extra-mozzarella', 'olives', 'mushrooms'] }, 3);
  assert.deepEqual(result.unitPrice, eur(1190 + 350 + 90 + 90 + 150));
  assert.deepEqual(result.lineTotal, eur((1190 + 350 + 90 + 90 + 150) * 3));
  assert.deepEqual(result.basePrice, eur(1190));
  assert.equal(result.quantity, 3);
  assert.deepEqual(result.breakdown.map((entry) => [entry.optionId, entry.priceDeltaMinor]), [
    ['large', 350],
    ['olives', 90],
    ['mushrooms', 90],
    ['extra-mozzarella', 150]
  ]);
  assert.ok(Number.isInteger(result.unitPrice.minorUnits) && Number.isInteger(result.lineTotal.minorUnits));
});

test('a negative delta is allowed while the unit price stays at or above zero', () => {
  assert.deepEqual(priced(pizza, eur(1190), { size: ['small'] }, 1).unitPrice, eur(990));
  assert.deepEqual(priced(pizza, eur(200), { size: ['small'] }, 2).lineTotal, eur(0));
  assert.deepEqual(errors(pizza, eur(199), { size: ['small'] }, 1), [{ code: 'negative_unit_price', path: ['unitPrice'] }]);
});

test('the unit price has exactly the Money shape that commerce lines take', () => {
  const { unitPrice } = priced(pizza, eur(1190), {}, 1);
  assert.deepEqual(Object.keys(unitPrice).sort(), ['currency', 'minorUnits']);
});

test('rejects non-integer, unsafe, negative or missing base prices', () => {
  for (const minorUnits of [11.9, Number.MAX_SAFE_INTEGER + 1, -1, Number.NaN]) {
    assert.deepEqual(errors(pizza, eur(minorUnits), {}, 1), [{ code: 'invalid_base_price', path: ['basePrice', 'minorUnits'] }]);
  }
  assert.deepEqual(errors(pizza, null as unknown as Money, {}, 1), [
    { code: 'invalid_base_price', path: ['basePrice', 'minorUnits'] },
    { code: 'currency_mismatch', path: ['basePrice', 'currency'] }
  ]);
});

test('rejects a base price in another currency', () => {
  assert.deepEqual(errors(pizza, { currency: 'CZK', minorUnits: 29000 }, {}, 1), [{ code: 'currency_mismatch', path: ['basePrice', 'currency'] }]);
  assert.deepEqual(errors(pizza, { currency: 'eur', minorUnits: 1190 }, {}, 1), [{ code: 'currency_mismatch', path: ['basePrice', 'currency'] }]);
});

test('rejects quantities that are not positive safe integers', () => {
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    assert.deepEqual(errors(pizza, eur(1190), {}, quantity), [{ code: 'invalid_quantity', path: ['quantity'] }]);
  }
});

test('rejects a line total beyond the safe integer range', () => {
  assert.deepEqual(errors(pizza, eur(Number.MAX_SAFE_INTEGER), {}, 2), [{ code: 'amount_overflow', path: ['lineTotal'] }]);
  assert.deepEqual(errors(pizza, eur(Number.MAX_SAFE_INTEGER), { size: ['large'] }, 1), [{ code: 'amount_overflow', path: ['lineTotal'] }]);
  assert.deepEqual(priced(pizza, eur(Number.MAX_SAFE_INTEGER - 350), { size: ['large'] }, 1).unitPrice, eur(Number.MAX_SAFE_INTEGER));
});

test('large deltas are summed exactly and checked for range', () => {
  const huge: ProductOptions = {
    productId: 'book',
    currency: 'EUR',
    groups: [{
      id: 'edition', labelKey: 'options.edition', selection: 'multiple', min: 0, max: 2, required: false,
      options: [
        { id: 'signed', labelKey: 'options.signed', priceDeltaMinor: Number.MAX_SAFE_INTEGER, available: true },
        { id: 'discount', labelKey: 'options.discount', priceDeltaMinor: -Number.MAX_SAFE_INTEGER, available: true }
      ]
    }]
  };
  assert.deepEqual(priced(huge, eur(5), { edition: ['signed', 'discount'] }, 1).unitPrice, eur(5));
  assert.deepEqual(errors(huge, eur(5), { edition: ['signed'] }, 1), [{ code: 'amount_overflow', path: ['lineTotal'] }]);
});

test('selection and definition errors stop pricing', () => {
  assert.deepEqual(errors(pizza, eur(1190), { extras: ['truffle'] }, 1), [{ code: 'option_unavailable', path: ['selection', 'extras', 0] }]);
  assert.deepEqual(errors({ ...pizza, currency: 'euro' }, eur(1190), {}, 1), [{ code: 'invalid_currency', path: ['currency'] }]);
});

test('the resolved selection gives the same cart key whatever order the client sent', () => {
  const a = priced(pizza, eur(1190), { extras: ['olives', 'mushrooms'], size: ['large'] }, 1);
  const b = priced(pizza, eur(1190), { size: ['large'], extras: ['mushrooms', 'olives'] }, 1);
  assert.equal(lineKey('pizza', a.selection), lineKey('pizza', b.selection));
  assert.equal(lineKey('pizza', priced(pizza, eur(1190), {}, 1).selection), lineKey('pizza', priced(pizza, eur(1190), { size: ['medium'] }, 1).selection));
});
