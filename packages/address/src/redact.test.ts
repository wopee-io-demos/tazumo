import assert from 'node:assert/strict';
import test from 'node:test';
import { redactAddress, type DeliveryAddress } from './index.ts';

function prng(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const letters = 'abcdefghijklmnopqrstuvwxyzáäčďéíĺľňóôŕšťúýžěřůßöü ';
const pick = (random: () => number, alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');

test('redaction keeps only the country and the first two postal digits', () => {
  assert.equal(redactAddress({ countryCode: 'SK', postalCode: '811 01' }), 'SK 81***');
  assert.equal(redactAddress({ countryCode: 'de', postalCode: '10115' }), 'DE 10***');
  assert.equal(redactAddress({ countryCode: 'AT', postalCode: '1010' }), 'AT 10**');
  assert.equal(redactAddress({ countryCode: 'Fiktívna 7', postalCode: 'Fiktívna 7' }), '-- ***');
  assert.equal(redactAddress({ countryCode: 'SK', postalCode: '8110123456' }), 'SK ***');
  assert.equal(redactAddress(null), '-- ***');
});

test('property: redaction depends only on country and postal code, never on street, house number, city or instructions', () => {
  const random = prng(94);
  for (let i = 0; i < 2_000; i++) {
    const street = pick(random, 'abcdefghijklmnopqrstuvwxyzáäčďéíĺľňóôŕšťúýžěřůßöü', 4 + Math.floor(random() * 20));
    const house = `${1 + Math.floor(random() * 9_999)}${random() < 0.3 ? '/' + Math.floor(random() * 99) : ''}`;
    const market = (['SK', 'CZ', 'DE', 'AT'] as const)[i % 4];
    const postalCode = String(Math.floor(random() * 100_000)).padStart(5, '0').slice(0, market === 'AT' ? 4 : 5);
    const address: DeliveryAddress = {
      countryCode: market,
      postalCode,
      addressLine1: `${street} ${house}`,
      addressLine2: `${pick(random, letters, 10)} ${house}`,
      city: pick(random, letters, 8),
      instructions: `${house} ${pick(random, letters, 30)}`,
    };
    const out = redactAddress(address);
    assert.equal(out, redactAddress({ countryCode: market, postalCode }));
    assert.match(out, /^[A-Z]{2} \d{2}\*{2,3}$/);
    assert.ok(!out.toLowerCase().includes(street), out);
  }
});
