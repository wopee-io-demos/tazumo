import test from 'node:test';
import assert from 'node:assert/strict';
import { assertValidMarket, divideRoundHalfUp, formatMinor, marketCodes, markets, roundToIncrement, vatCategories, vatSources } from './index.ts';

const plain = (s: string) => s.replace(/[  ]/g, ' ');

test('every launch market is internally consistent', () => {
  for (const code of marketCodes) assert.doesNotThrow(() => assertValidMarket(markets[code]));
});

test('market currency, locale and display rules', () => {
  assert.deepEqual(
    marketCodes.map((c) => [c, markets[c].currency, markets[c].locale, markets[c].pricesIncludeVat, markets[c].rounding.cashIncrementMinor]),
    [
      ['SK', 'EUR', 'sk-SK', true, 1],
      ['CZ', 'CZK', 'cs-CZ', true, 100],
      ['DE', 'EUR', 'de-DE', true, 1],
      ['AT', 'EUR', 'de-AT', true, 1]
    ]
  );
});

test('default VAT rates by category (research data to re-verify)', () => {
  const table = Object.fromEntries(
    marketCodes.map((c) => [c, vatCategories.map((cat) => markets[c].vat.rates[markets[c].vat.categoryDefaults[cat]].basisPoints)])
  );
  assert.deepEqual(table, {
    SK: [1900, 1900, 2300, 2300, 2300],
    CZ: [1200, 1200, 2100, 2100, 2100],
    DE: [700, 700, 700, 1900, 1900],
    AT: [1000, 1000, 1300, 2000, 2000]
  });
});

test('every VAT rate cites official sources with a retrieval date and is flagged for re-verification', () => {
  for (const code of marketCodes) {
    const { vat } = markets[code];
    assert.equal(vat.status, 'reverify');
    for (const rate of Object.values(vat.rates)) {
      assert.ok(
        rate.sourceIds.some((id) => !vatSources[id]?.url.includes('europa.eu')),
        `${code}.${rate.id} needs a national official source`
      );
      for (const id of rate.sourceIds) {
        const source = vatSources[id];
        assert.ok(source, `${code}.${rate.id} cites unknown source ${id}`);
        assert.match(source.url, /^https:\/\/([a-z0-9-]+\.)*(europa\.eu|financnasprava\.sk|financnisprava\.gov\.cz|gesetze-im-internet\.de|bka\.gv\.at|usp\.gv\.at)\//);
        assert.match(source.retrievedOn, /^\d{4}-\d{2}-\d{2}$/);
      }
      if (code === 'AT' && rate.id === 'basicFood') assert.ok(!rate.sourceIds.includes('eu-your-europe'), 'the EU overview does not list 4.9 %');
    }
  }
});

test('half-up rounding with exact integer arithmetic', () => {
  assert.deepEqual(
    [
      [5n, 10n],
      [15n, 10n],
      [25n, 10n],
      [14n, 10n],
      [-15n, 10n],
      [0n, 7n]
    ].map(([n, d]) => divideRoundHalfUp(n, d)),
    [1n, 2n, 3n, 1n, -2n, 0n]
  );
  assert.throws(() => divideRoundHalfUp(1n, 0n), RangeError);
  assert.deepEqual([roundToIncrement(26750, 100), roundToIncrement(26749, 100), roundToIncrement(26701, 100), roundToIncrement(-50, 100)], [26800, 26700, 26700, -100]);
});

test('CZK shows whole crowns without halers, other amounts keep two decimals', () => {
  assert.equal(plain(formatMinor(markets.CZ, 26800)), '268 Kč');
  assert.equal(plain(formatMinor(markets.CZ, 2395)), '23,95 Kč');
  assert.equal(plain(formatMinor(markets.CZ, 123400)), '1 234 Kč');
  assert.equal(plain(formatMinor(markets.DE, 1000)), '10,00 €');
  assert.equal(plain(formatMinor(markets.SK, 1190)), '11,90 €');
  assert.equal(plain(formatMinor(markets.AT, 1190)), '€ 11,90');
});
