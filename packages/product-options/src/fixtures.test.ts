import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '@tazumo/core';
import { priceSelection, validateOptionGroups } from './index.ts';
import { syntheticOptionLabel, syntheticOptionLabels, syntheticOptionsFor, syntheticProductOptions } from './fixtures.ts';

test('synthetic fixtures are valid, marked synthetic and use existing product IDs only', () => {
  assert.ok(syntheticProductOptions.length >= 2);
  const ids = new Set(products.map((product) => product.id));
  for (const def of syntheticProductOptions) {
    assert.deepEqual(validateOptionGroups(def), [], def.productId);
    assert.equal(def.synthetic, true);
    assert.ok(ids.has(def.productId), `${def.productId} is not a core fixture product`);
  }
  assert.equal(new Set(syntheticProductOptions.map((def) => def.productId)).size, syntheticProductOptions.length);
});

test('every fixture prices its defaults from the core catalogue price', () => {
  for (const def of syntheticProductOptions) {
    const product = products.find((candidate) => candidate.id === def.productId)!;
    const result = priceSelection(def, { currency: def.currency, minorUnits: product.priceCents }, {}, 1);
    assert.ok(result.ok, def.productId);
    assert.ok(result.unitPrice.minorUnits >= 0);
  }
});

test('looks up fixtures by product id', () => {
  assert.equal(syntheticOptionsFor('pizza')?.productId, 'pizza');
  assert.equal(syntheticOptionsFor('headphones'), undefined);
});

test('every fixture label key has a label in every language', () => {
  const keys = syntheticProductOptions.flatMap((def) => def.groups.flatMap((g) => [g.labelKey, ...g.options.map((o) => o.labelKey)]));
  for (const language of ['en', 'cs', 'de'] as const) {
    for (const key of keys) assert.notEqual(syntheticOptionLabel(language, key), key, `${language} ${key}`);
    assert.deepEqual(Object.keys(syntheticOptionLabels[language]).sort(), [...keys].sort(), language);
  }
  assert.equal(syntheticOptionLabel('cs', 'options.unknown'), 'options.unknown');
});
