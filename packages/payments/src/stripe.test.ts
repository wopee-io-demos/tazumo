import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentError, assertTestModeKey, createStripeTestProvider } from './index.ts';
import { toView } from './stripe.ts';

const code = (c: string) => (e: unknown) => e instanceof PaymentError && e.code === c;
const live = (prefix: 'sk' | 'rk') => `${prefix}_${'live'}_${'A1b2C3d4'.repeat(3)}`;
const orderId = '0b9e3c1a-6f1d-4e7a-9a7b-2f4c5d6e7f80';
const unreachable = { host: '127.0.0.1', port: 9, protocol: 'http' as const };

describe('test-mode key guard', () => {
  it('refuses live secret and restricted keys at construction without echoing them', () => {
    for (const key of [live('sk'), live('rk')]) {
      assert.throws(
        () => createStripeTestProvider({ secretKey: key }),
        (e: unknown) => code('live_key_refused')(e) && !(e as Error).message.includes(key) && !JSON.stringify((e as PaymentError).details).includes(key)
      );
    }
  });

  it('refuses publishable, empty, partial and non-string keys', () => {
    for (const key of ['pk_test_123', 'sk_test_', ' sk_test_123', 'sk_test_12 3', '', undefined, 42]) {
      assert.throws(() => assertTestModeKey(key), code('invalid_key'), String(key));
    }
  });

  it('accepts test-mode secret and restricted keys', () => {
    for (const secretKey of ['sk_test_123', 'rk_test_123']) {
      const provider = createStripeTestProvider({ secretKey, endpoint: unreachable });
      assert.equal(provider.mode, 'test');
      assert.equal(provider.provider, 'stripe');
    }
  });
});

describe('input checks before any provider call', () => {
  const provider = createStripeTestProvider({ secretKey: 'sk_test_123', endpoint: unreachable, maxNetworkRetries: 0 });
  const base = { orderId, amount: { currency: 'EUR', minorUnits: 1250 }, idempotencyKey: `tazumo-create-${orderId}` };

  it('rejects raw card data in place of a token', async () => {
    for (const paymentMethodToken of ['4242424242424242', 'tok_visa', 'pm_', { number: '4242424242424242', cvc: '123' }]) {
      await assert.rejects(provider.createPaymentIntent({ ...base, paymentMethodToken } as never), code('invalid_token'));
    }
  });

  it('rejects unsupported currencies, bad ids and missing keys', async () => {
    await assert.rejects(provider.createPaymentIntent({ ...base, amount: { currency: 'USD', minorUnits: 1250 } }), code('unsupported_currency'));
    await assert.rejects(provider.createPaymentIntent({ ...base, orderId: 'order-1' }), code('invalid_order_id'));
    await assert.rejects(provider.createPaymentIntent({ ...base, idempotencyKey: '' }), code('invalid_idempotency_key'));
    await assert.rejects(provider.retrievePaymentIntent('pi_../../v1/customers'), code('invalid_payment_reference'));
    await assert.rejects(provider.cancelPaymentIntent('pi_123', {} as never), code('invalid_idempotency_key'));
  });

  it('maps an unreachable provider to provider_unavailable', async () => {
    await assert.rejects(provider.retrievePaymentIntent('pi_123'), code('provider_unavailable'));
  });

  it('refuses live-mode provider objects', () => {
    const intent = { id: 'pi_123', livemode: true, status: 'succeeded', amount: 100, currency: 'eur', metadata: {} };
    assert.throws(() => toView(intent as never), code('live_mode'));
  });
});
