import assert from 'node:assert/strict';
import test from 'node:test';
import { addressMarkets, normalizeAddress, validateAddress, type AddressMarket, type DeliveryAddress } from './index.ts';

const valid: Record<AddressMarket, DeliveryAddress> = {
  SK: { countryCode: 'SK', postalCode: '811 01', addressLine1: 'Fiktívna 7', city: 'Vymyslené Mesto' },
  CZ: { countryCode: 'CZ', postalCode: '110 00', addressLine1: 'Smyšlená 3', addressLine2: 'byt 4', city: 'Fiktivní Město' },
  DE: { countryCode: 'DE', postalCode: '10115', addressLine1: 'Erfundene Straße 5', city: 'Beispielstadt', instructions: 'Bitte klingeln' },
  AT: { countryCode: 'AT', postalCode: '1010', addressLine1: 'Fiktivgasse 2', city: 'Musterdorf' },
};

test('valid addresses pass for every market and keep their diacritics', () => {
  for (const market of addressMarkets) {
    const result = validateAddress(market, valid[market]);
    assert.deepEqual(result, { ok: true, address: valid[market] }, market);
  }
});

test('normalization trims, collapses whitespace, formats postal codes, keeps diacritics and is idempotent', () => {
  const messy = { countryCode: ' sk ', postalCode: '81101', addressLine1: '  Fiktívna   7 ', addressLine2: '   ', city: 'Vymyslené Mesto', instructions: '  ' };
  const once = normalizeAddress(messy);
  assert.deepEqual(once, { countryCode: 'SK', postalCode: '811 01', addressLine1: 'Fiktívna 7', city: 'Vymyslené Mesto' });
  assert.deepEqual(normalizeAddress(once), once);
  assert.deepEqual(normalizeAddress({ ...valid.DE, postalCode: ' 101 15 ' }).postalCode, '10115');
  for (const market of addressMarkets) assert.deepEqual(normalizeAddress(normalizeAddress(valid[market])), normalizeAddress(valid[market]));
  assert.deepEqual(validateAddress('SK', messy), { ok: true, address: once });
});

test('wrong postal format per market is rejected on the postalCode path', () => {
  const wrong: Record<AddressMarket, string[]> = {
    SK: ['8110', '811 011', 'A11 01', '811-01'],
    CZ: ['1100', '11 00', 'CZ110 00', '110 000'],
    DE: ['1011', '101155', '1O115'],
    AT: ['101', '10100', 'A-1010'],
  };
  for (const market of addressMarkets) {
    for (const postalCode of wrong[market]) {
      assert.deepEqual(validateAddress(market, { ...valid[market], postalCode }), { ok: false, errors: [{ path: 'postalCode', code: 'invalid_format' }] }, `${market} ${postalCode}`);
    }
  }
});

test('unsupported countries and market mismatches are rejected', () => {
  assert.deepEqual(validateAddress('SK', { ...valid.SK, countryCode: 'PL' }), { ok: false, errors: [{ path: 'countryCode', code: 'unsupported_country' }] });
  assert.deepEqual(validateAddress('SK', { ...valid.CZ }), { ok: false, errors: [{ path: 'countryCode', code: 'market_mismatch' }] });
  assert.deepEqual(validateAddress('HU' as AddressMarket, valid.SK), { ok: false, errors: [{ path: 'market', code: 'unsupported_country' }] });
});

test('missing or blank required fields are rejected with their paths', () => {
  const { addressLine1: _line1, ...noLine1 } = valid.SK;
  assert.deepEqual(validateAddress('SK', noLine1), { ok: false, errors: [{ path: 'addressLine1', code: 'required' }] });
  assert.deepEqual(validateAddress('SK', { ...valid.SK, city: '  ' }), { ok: false, errors: [{ path: 'city', code: 'required' }] });
  assert.deepEqual(validateAddress('SK', {}), {
    ok: false,
    errors: ['countryCode', 'postalCode', 'addressLine1', 'city'].map((path) => ({ path, code: 'required' })),
  });
});

test('over-length fields are rejected, counted in characters after normalization', () => {
  const atLimit = { ...valid.SK, addressLine1: 'ž'.repeat(120), city: 'á'.repeat(80), instructions: 'x'.repeat(500) };
  assert.equal(validateAddress('SK', atLimit).ok, true);
  assert.deepEqual(validateAddress('SK', { ...atLimit, addressLine1: 'ž'.repeat(121), addressLine2: 'b'.repeat(121), city: 'á'.repeat(81), instructions: 'x'.repeat(501) }), {
    ok: false,
    errors: ['addressLine1', 'addressLine2', 'city', 'instructions'].map((path) => ({ path, code: 'too_long' })),
  });
  assert.equal(validateAddress('SK', { ...valid.SK, addressLine1: `  ${'ž'.repeat(120)}   ` }).ok, true);
});

test('unknown fields, wrong types and control characters are rejected', () => {
  assert.deepEqual(validateAddress('DE', { ...valid.DE, phone: '+49' }), { ok: false, errors: [{ path: 'phone', code: 'unknown_field' }] });
  assert.deepEqual(validateAddress('DE', { ...valid.DE, postalCode: 10115 }), { ok: false, errors: [{ path: 'postalCode', code: 'invalid_type' }] });
  assert.deepEqual(validateAddress('DE', { ...valid.DE, addressLine1: 'Erfundene\u0000Straße' }), { ok: false, errors: [{ path: 'addressLine1', code: 'invalid_characters' }] });
  for (const input of [null, 'Fiktívna 7', [valid.DE]]) assert.deepEqual(validateAddress('DE', input), { ok: false, errors: [{ path: '', code: 'invalid_type' }] });
  assert.equal(validateAddress('DE', { ...valid.DE, instructions: 'Hinterhof\n\tzweiter Stock\r\n' }).ok, true);
  for (const instructions of ['a\u0000b', 'a\u001b[31mb', 'a\u0085b', 'a\u202eb']) {
    assert.deepEqual(validateAddress('DE', { ...valid.DE, instructions }), { ok: false, errors: [{ path: 'instructions', code: 'invalid_characters' }] }, JSON.stringify(instructions));
  }
});

test('zero-width and bidirectional formatting characters are rejected, so they cannot fake a non-blank field', () => {
  for (const hidden of ['\u200b', '\u200d', '\u2060', '\ufeff', '\u202e', '\u2066']) {
    assert.deepEqual(validateAddress('SK', { ...valid.SK, addressLine1: hidden }), { ok: false, errors: [{ path: 'addressLine1', code: 'invalid_characters' }] }, JSON.stringify(hidden));
    assert.deepEqual(validateAddress('SK', { ...valid.SK, city: `Vymyslené${hidden}Mesto` }), { ok: false, errors: [{ path: 'city', code: 'invalid_characters' }] });
  }
});
