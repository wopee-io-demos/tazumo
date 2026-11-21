import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LINE_QUANTITY as COMMERCE_MAX_LINE_QUANTITY, getMarket, priceBreakdown, type Money as CommerceMoney } from '@tazumo/commerce';
import { MAX_LINE_QUANTITY, priceSelection, type Money, type PricedSelection } from './index.ts';
import { syntheticProductOptions } from './fixtures.ts';
import { products } from '@tazumo/core';

const toCommerce = (money: Money): CommerceMoney => money;
const fromCommerce = (money: CommerceMoney): Money => money;

const priced = (result: ReturnType<typeof priceSelection>): PricedSelection => {
  assert.ok(result.ok, JSON.stringify(result));
  return result;
};

test('Money is interchangeable with the commerce Money type and the quantity caps agree', () => {
  assert.deepEqual(fromCommerce(toCommerce({ currency: 'EUR', minorUnits: 1190 })), { currency: 'EUR', minorUnits: 1190 });
  assert.equal(MAX_LINE_QUANTITY, COMMERCE_MAX_LINE_QUANTITY);
});

test('commerce prices an option line from unitPrice to the same line total', () => {
  const market = getMarket('SK');
  for (const def of syntheticProductOptions) {
    const base = { currency: def.currency, minorUnits: products.find((product) => product.id === def.productId)!.priceCents };
    for (const quantity of [1, 3, MAX_LINE_QUANTITY]) {
      const result = priced(priceSelection(def, base, {}, quantity));
      const breakdown = priceBreakdown(market, {
        lines: [{ id: def.productId, quantity, unitPrice: toCommerce(result.unitPrice), vatCategory: 'food' }],
        deliveryDistanceMeters: 1000
      });
      assert.equal(breakdown.currency, result.unitPrice.currency);
      assert.equal(breakdown.lines[0].unitPriceMinor, result.unitPrice.minorUnits);
      assert.equal(breakdown.lines[0].amountMinor, result.lineTotal.minorUnits);
    }
  }
});

test('a configured pizza flows into commerce unchanged', () => {
  const pizza = syntheticProductOptions.find((def) => def.productId === 'pizza')!;
  const result = priced(priceSelection(pizza, { currency: 'EUR', minorUnits: 1190 }, { size: ['small'], extras: ['olives', 'mushrooms'] }, 2));
  const breakdown = priceBreakdown(getMarket('DE'), {
    lines: [{ id: 'pizza', quantity: result.quantity, unitPrice: result.unitPrice, vatCategory: 'food' }],
    deliveryDistanceMeters: 1000
  });
  assert.equal(breakdown.lines[0].amountMinor, (1190 - 200 + 90 + 90) * 2);
});
