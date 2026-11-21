import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentError, assertIdempotencyKey, assertPaymentMatchesOrder, fromStripeAmount, pspIdempotencyKey, supportedCurrencies, toStripeAmount } from './index.ts';

const code = (c: string) => (e: unknown) => e instanceof PaymentError && e.code === c;
const orderId = '0b9e3c1a-6f1d-4e7a-9a7b-2f4c5d6e7f80';

describe('money in integer minor units', () => {
  it('supports exactly the @tazumo/commerce market currencies', () => {
    assert.deepEqual([...supportedCurrencies].sort(), ['CZK', 'EUR']);
  });

  it('converts to Stripe amounts without scaling', () => {
    assert.deepEqual(toStripeAmount({ currency: 'EUR', minorUnits: 1250 }), { amount: 1250, currency: 'eur' });
    assert.deepEqual(toStripeAmount({ currency: 'CZK', minorUnits: 31950 }), { amount: 31950, currency: 'czk' });
  });

  it('rejects other currencies and non-integer, zero, negative or unsafe amounts', () => {
    assert.throws(() => toStripeAmount({ currency: 'USD', minorUnits: 100 }), code('unsupported_currency'));
    assert.throws(() => toStripeAmount({ currency: 'eur', minorUnits: 100 }), code('unsupported_currency'));
    for (const minorUnits of [0, -1, 12.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => toStripeAmount({ currency: 'EUR', minorUnits }), code('invalid_amount'), String(minorUnits));
    }
  });

  it('reads provider amounts only for two-decimal ISO currencies', () => {
    assert.deepEqual(fromStripeAmount(1099, 'usd'), { currency: 'USD', minorUnits: 1099 });
    assert.throws(() => fromStripeAmount(1000, 'jpy'), code('unsupported_currency'));
    assert.throws(() => fromStripeAmount(1000, 'kwd'), code('unsupported_currency'));
    assert.throws(() => fromStripeAmount(10.5, 'eur'), code('invalid_provider_response'));
  });

  it('settles an order only for the exact total in the order currency', () => {
    const total = { currency: 'EUR', minorUnits: 1250 };
    assert.doesNotThrow(() => assertPaymentMatchesOrder({ currency: 'EUR', minorUnits: 1250 }, total));
    assert.throws(() => assertPaymentMatchesOrder({ currency: 'CZK', minorUnits: 1250 }, total), code('currency_mismatch'));
    assert.throws(() => assertPaymentMatchesOrder({ currency: 'EUR', minorUnits: 1249 }, total), code('amount_mismatch'));
  });
});

describe('idempotency keys', () => {
  it('derives one deterministic provider key per order and operation', () => {
    assert.equal(pspIdempotencyKey(orderId, 'create'), `tazumo-create-${orderId}`);
    assert.notEqual(pspIdempotencyKey(orderId, 'create'), pspIdempotencyKey(orderId, 'cancel'));
    assert.doesNotThrow(() => assertIdempotencyKey(pspIdempotencyKey(orderId, 'cancel')));
  });

  it('rejects malformed order ids and keys', () => {
    assert.throws(() => pspIdempotencyKey(orderId.toUpperCase(), 'create'), code('invalid_order_id'));
    for (const key of [undefined, '', 'short', 'has space in it', 'x'.repeat(129), 'ünïcødé-key']) {
      assert.throws(() => assertIdempotencyKey(key), code('invalid_idempotency_key'), String(key));
    }
  });
});
