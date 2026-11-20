import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '@tazumo/core';
import { buildSeed, slugify, uuidV5 } from '../src/fixtures.ts';

test('uuidV5 matches the RFC 4122 reference vector', () => {
  assert.equal(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('seed preserves every fixture product ID, price and merchant', () => {
  const seed = buildSeed();
  assert.equal(seed.products.length, products.length);
  for (const fixture of products) {
    const row = seed.products.find((p) => p.slug === fixture.id);
    assert.ok(row, `missing fixture ${fixture.id}`);
    assert.equal(row.priceMinor, fixture.priceCents);
    assert.equal(row.currency, 'EUR');
    assert.equal(row.id, uuidV5(`product:${fixture.id}`));
    assert.equal(seed.merchants.find((m) => m.id === row.merchantId)?.name, fixture.merchant);
  }
});

test('seed IDs are deterministic and unique', () => {
  const a = buildSeed();
  const b = buildSeed();
  assert.deepEqual(a, b);
  assert.equal(new Set(a.products.map((p) => p.id)).size, a.products.length);
  assert.equal(new Set(a.merchants.map((m) => m.slug)).size, a.merchants.length);
  assert.equal(slugify('Bun & Co'), 'bun-co');
});
