import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommerceRuleError,
  getMarket,
  marketCodes,
  markets,
  priceBreakdown,
  type MarketConfig,
  type OrderLineInput,
  type PriceBreakdown
} from './index.ts';

const eur = (minorUnits: number) => ({ currency: 'EUR', minorUnits });
const czk = (minorUnits: number) => ({ currency: 'CZK', minorUnits });
const line = (id: string, unitPrice: { currency: string; minorUnits: number }, extra: Partial<OrderLineInput> = {}): OrderLineInput => ({
  id,
  quantity: 1,
  unitPrice,
  vatCategory: 'electronics',
  ...extra
});

const payableFromComponents = (b: PriceBreakdown) => b.components.filter((c) => c.addsToPayable).reduce((sum, c) => sum + c.amountMinor, 0);

const noFees = (base: MarketConfig, overrides: Partial<MarketConfig> = {}): MarketConfig => ({
  ...base,
  deliveryFee: { synthetic: true, baseMinor: 0, bands: [{ upToMeters: 1000, feeMinor: 0 }] },
  smallOrderSurcharge: { synthetic: true, thresholdMinor: 0, capMinor: 0 },
  ...overrides
});

test('SK basket with three VAT rates explains every component', () => {
  const b = priceBreakdown(markets.SK, {
    deliveryDistanceMeters: 1500,
    lines: [
      line('pizza', eur(1190), { quantity: 2, vatCategory: 'food' }),
      line('headphones', eur(3990)),
      line('apples', eur(390), { quantity: 3, vatCategory: 'groceries', vatRateId: 'superReduced' })
    ]
  });
  assert.equal(b.subtotalMinor, 7540);
  assert.equal(b.deliveryFee.amountMinor, 149);
  assert.equal(b.smallOrderSurcharge.amountMinor, 0);
  assert.deepEqual(
    b.vat.map((g) => [g.rateId, g.basisPoints, g.netMinor, g.vatMinor, g.grossMinor]),
    [
      ['standard', 2300, 3365, 774, 4139],
      ['reduced', 1900, 2000, 380, 2380],
      ['superReduced', 500, 1114, 56, 1170]
    ]
  );
  assert.equal(b.totalMinor, 7689);
  assert.equal(b.payableMinor, 7689);
  assert.equal(b.roundingMinor, 0);
  assert.equal(payableFromComponents(b), b.payableMinor);
  assert.deepEqual(
    b.components.map((c) => c.kind),
    ['line', 'line', 'line', 'subtotal', 'delivery_fee', 'small_order_surcharge', 'vat', 'vat', 'vat', 'total']
  );
  assert.ok(b.components.every((c) => c.explanation.length > 0));
  assert.match(b.lines[0].explanation, /^2 × 11,90\s€ = 23,80\s€, VAT 19 %/);
  assert.match(b.vat[0].explanation, /re-verify, retrieved 2026-11-20/);
});

test('VAT inside VAT-inclusive prices is shown but never added again', () => {
  const b = priceBreakdown(markets.DE, { deliveryDistanceMeters: 0, lines: [line('flowers', eur(1790), { vatCategory: 'flowers' })] });
  const vat = b.components.filter((c) => c.kind === 'vat');
  assert.ok(vat.length > 0 && vat.every((c) => !c.addsToPayable));
  assert.equal(b.totalMinor, 1790 + 149);
  assert.equal(b.vat.reduce((s, g) => s + g.grossMinor, 0), b.totalMinor);
});

test('AT applies 13 % to flowers and the 4.9 % rate only when a line opts in', () => {
  const b = priceBreakdown(markets.AT, {
    deliveryDistanceMeters: 0,
    lines: [line('bread', eur(450), { vatCategory: 'groceries', vatRateId: 'basicFood' }), line('flowers', eur(1790), { vatCategory: 'flowers' })]
  });
  assert.deepEqual(
    b.vat.map((g) => [g.rateId, g.netMinor, g.vatMinor]),
    [
      ['standard', 124, 25],
      ['reduced13', 1584, 206],
      ['basicFood', 429, 21]
    ]
  );
  const plain = priceBreakdown(markets.AT, { deliveryDistanceMeters: 0, lines: [line('bread', eur(450), { vatCategory: 'groceries' })] });
  assert.equal(plain.lines[0].vatBasisPoints, 1000);
});

test('CZK: half-haler VAT rounds half up and the payable total is whole crowns', () => {
  const b = priceBreakdown(markets.CZ, { deliveryDistanceMeters: 3000, lines: [line('svickova', czk(12950), { vatCategory: 'food' })] });
  assert.equal(b.deliveryFee.amountMinor, 3900 + 2000);
  assert.equal(b.smallOrderSurcharge.amountMinor, 7900);
  assert.deepEqual(
    b.vat.map((g) => [g.rateId, g.netMinor, g.vatMinor]),
    [
      ['standard', 11405, 2395],
      ['reduced', 11563, 1387]
    ]
  );
  assert.equal(b.totalMinor, 26750);
  assert.equal(b.payableMinor, 26800);
  assert.equal(b.roundingMinor, 50);
  assert.equal(b.payableMinor % 100, 0);
  assert.equal(payableFromComponents(b), b.payableMinor);
  const rounding = b.components.find((c) => c.kind === 'rounding');
  assert.match(rounding?.explanation ?? '', /nearest 1\sKč: \+0\.50 CZK/);
  assert.match(b.components.at(-1)?.explanation ?? '', /^Amount to pay 268\sKč$/);
});

test('CZK rounds down below half a crown', () => {
  const b = priceBreakdown(markets.CZ, { deliveryDistanceMeters: 3000, lines: [line('svickova', czk(12949), { vatCategory: 'food' })] });
  assert.equal(b.totalMinor, 26749);
  assert.equal(b.payableMinor, 26700);
  assert.equal(b.roundingMinor, -49);
  assert.equal(payableFromComponents(b), 26700);
});

test('EUR markets never round the payable amount', () => {
  for (const code of ['SK', 'DE', 'AT'] as const) {
    const b = priceBreakdown(markets[code], { deliveryDistanceMeters: 0, lines: [line('x', eur(1001))] });
    assert.equal(b.payableMinor, b.totalMinor);
    assert.ok(!b.components.some((c) => c.kind === 'rounding'));
  }
});

test('VAT-exclusive markets add VAT per rate with half-up rounding', () => {
  const b2b = noFees(markets.DE, { pricesIncludeVat: false });
  const half = priceBreakdown(b2b, { deliveryDistanceMeters: 0, lines: [line('a', eur(150))] });
  assert.deepEqual([half.vat[0].netMinor, half.vat[0].vatMinor, half.totalMinor], [150, 29, 179]);
  const mixed = priceBreakdown(b2b, {
    deliveryDistanceMeters: 0,
    lines: [line('a', eur(50)), line('b', eur(1000), { vatCategory: 'groceries' })]
  });
  assert.deepEqual(
    mixed.vat.map((g) => [g.netMinor, g.vatMinor]),
    [
      [50, 10],
      [1000, 70]
    ]
  );
  assert.equal(mixed.totalMinor, 1130);
  assert.ok(mixed.components.filter((c) => c.kind === 'vat').every((c) => c.addsToPayable));
  assert.equal(payableFromComponents(mixed), 1130);
});

test('VAT is rounded once per rate, not per line', () => {
  const b = priceBreakdown(noFees(markets.SK), { deliveryDistanceMeters: 0, lines: [line('a', eur(3)), line('b', eur(3))] });
  assert.deepEqual([b.vat.length, b.vat[0].grossMinor, b.vat[0].netMinor, b.vat[0].vatMinor], [1, 6, 5, 1]);
});

test('delivery distance bands are inclusive at the upper bound', () => {
  const fee = (d: number) => priceBreakdown(markets.DE, { deliveryDistanceMeters: d, lines: [line('x', eur(5000))] }).deliveryFee.amountMinor;
  assert.deepEqual([fee(0), fee(2000), fee(2000.5), fee(4000), fee(7000)], [149, 149, 249, 249, 399]);
});

test('small-order surcharge fills the gap to the threshold up to the cap', () => {
  const surcharge = (minor: number) => priceBreakdown(markets.DE, { deliveryDistanceMeters: 0, lines: [line('x', eur(minor))] }).smallOrderSurcharge.amountMinor;
  assert.deepEqual([surcharge(1000), surcharge(999), surcharge(800), surcharge(100), surcharge(0)], [0, 1, 200, 300, 300]);
});

test('fees are always labelled synthetic and the data status asks for re-verification', () => {
  for (const code of marketCodes) {
    const sample = getMarket(code).currency === 'CZK' ? czk(10000) : eur(500);
    const b = priceBreakdown(markets[code], { deliveryDistanceMeters: 2500, lines: [line('x', sample)] });
    const fees = b.components.filter((c) => c.kind === 'delivery_fee' || c.kind === 'small_order_surcharge');
    assert.ok(fees.every((c) => c.synthetic && /synthetic/i.test(c.explanation)));
    assert.equal(b.deliveryFee.synthetic, true);
    assert.equal(b.dataStatus.vatRates, 'reverify');
    assert.match(b.dataStatus.notice, /synthetic/);
    assert.equal(payableFromComponents(b), b.payableMinor);
  }
});

const rejects = (code: string, fn: () => unknown) =>
  assert.throws(fn, (err: unknown) => err instanceof CommerceRuleError && err.code === code, `expected ${code}`);

test('zero, negative, fractional and oversized quantities are rejected', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1000]) {
    rejects('invalid_quantity', () => priceBreakdown(markets.SK, { deliveryDistanceMeters: 0, lines: [line('x', eur(100), { quantity })] }));
  }
});

test('negative or fractional prices are rejected', () => {
  for (const minorUnits of [-1, 1.5, Number.NaN]) {
    rejects('invalid_amount', () => priceBreakdown(markets.SK, { deliveryDistanceMeters: 0, lines: [line('x', eur(minorUnits))] }));
  }
});

test('a line in another currency than the market is rejected', () => {
  rejects('currency_mismatch', () => priceBreakdown(markets.SK, { deliveryDistanceMeters: 0, lines: [line('x', czk(10000))] }));
  rejects('currency_mismatch', () => priceBreakdown(markets.CZ, { deliveryDistanceMeters: 0, lines: [line('x', eur(100))] }));
  rejects('currency_mismatch', () => priceBreakdown(markets.DE, { deliveryDistanceMeters: 0, lines: [line('x', { currency: 'eur', minorUnits: 100 })] }));
});

test('unknown categories, rates, markets and malformed orders are rejected', () => {
  const order = (lines: OrderLineInput[], deliveryDistanceMeters = 0) => () => priceBreakdown(markets.DE, { lines, deliveryDistanceMeters });
  rejects('unknown_vat_category', order([line('x', eur(100), { vatCategory: 'tobacco' as never })]));
  rejects('unknown_vat_rate', order([line('x', eur(100), { vatRateId: 'basicFood' })]));
  rejects('unknown_vat_rate', order([line('x', eur(100), { vatRateId: 'toString' })]));
  rejects('empty_order', order([]));
  rejects('invalid_line', order([line('', eur(100))]));
  rejects('duplicate_line', order([line('x', eur(100)), line('x', eur(200))]));
  rejects('invalid_distance', order([line('x', eur(100))], -1));
  rejects('invalid_distance', order([line('x', eur(100))], Number.NaN));
  rejects('outside_delivery_area', order([line('x', eur(100))], 7000.1));
  for (const code of ['PL', 'sk', '__proto__', 'toString', '']) rejects('unknown_market', () => getMarket(code));
});

test('amounts beyond the safe integer range are rejected instead of losing precision', () => {
  rejects('amount_overflow', () =>
    priceBreakdown(markets.DE, { deliveryDistanceMeters: 0, lines: [line('x', eur(Number.MAX_SAFE_INTEGER), { quantity: 999 })] })
  );
});

test('an inconsistent market configuration is rejected', () => {
  const broken: MarketConfig = {
    ...markets.DE,
    deliveryFee: {
      synthetic: true,
      baseMinor: 0,
      bands: [
        { upToMeters: 4000, feeMinor: 0 },
        { upToMeters: 2000, feeMinor: 0 }
      ]
    }
  };
  rejects('invalid_market_config', () => priceBreakdown(broken, { deliveryDistanceMeters: 0, lines: [line('x', eur(100))] }));
  const missingRate: MarketConfig = { ...markets.DE, vat: { ...markets.DE.vat, feeRateId: 'zero' } };
  rejects('invalid_market_config', () => priceBreakdown(missingRate, { deliveryDistanceMeters: 0, lines: [line('x', eur(100))] }));
});
