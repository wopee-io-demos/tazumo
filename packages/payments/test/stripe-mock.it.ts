import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PaymentError, assertPaymentMatchesOrder, createStripeTestProvider, paymentIntentStatuses, pspIdempotencyKey, type PaymentProvider } from '../src/index.ts';

const upstream = process.env.STRIPE_MOCK_URL;
if (!upstream) throw new Error('STRIPE_MOCK_URL must point at a running stripe/stripe-mock (see packages/payments/README.md)');
const target = new URL(upstream);

type Seen = { method: string; path: string; idempotencyKey: string | undefined; body: URLSearchParams };
const seen: Seen[] = [];
const bodiesByKey = new Map<string, string>();

/**
 * Records what the SDK puts on the wire, then forwards to stripe-mock. stripe-mock is stateless, so the proxy also
 * answers a reused key with different parameters the way Stripe documents (400 idempotency_error).
 */
function recordingProxy(): Server {
  return createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const key = req.headers['idempotency-key'] as string | undefined;
      seen.push({ method: req.method ?? '', path: req.url ?? '', idempotencyKey: key, body: new URLSearchParams(body) });
      if (key && bodiesByKey.has(key) && bodiesByKey.get(key) !== body) {
        res.writeHead(400, { 'content-type': 'application/json', 'request-id': 'req_proxy' });
        res.end(JSON.stringify({ error: { type: 'idempotency_error', message: 'Keys for idempotent requests can only be used with the same parameters they were first used with.' } }));
        return;
      }
      if (key) bodiesByKey.set(key, body);
      const forward = request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers: req.headers }, (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      });
      forward.on('error', () => res.writeHead(502).end());
      forward.end(body);
    });
  });
}

const code = (c: string) => (e: unknown) => e instanceof PaymentError && e.code === c;
const orderId = '5d1c6f0e-2b3a-4c8d-9e7f-a1b2c3d4e5f6';
const eur = { currency: 'EUR', minorUnits: 1250 };
let proxy: Server;
let provider: PaymentProvider;
const last = () => seen[seen.length - 1];

before(async () => {
  proxy = recordingProxy();
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const { port } = proxy.address() as AddressInfo;
  provider = createStripeTestProvider({ secretKey: 'sk_test_123', endpoint: { host: '127.0.0.1', port, protocol: 'http' }, maxNetworkRetries: 0 });
});
after(() => new Promise<void>((resolve) => proxy.close(() => resolve())));

describe('Stripe adapter against stripe-mock', () => {
  it('creates an unconfirmed PaymentIntent with the order reference and a deterministic idempotency key', async () => {
    const idempotencyKey = pspIdempotencyKey(orderId, 'create');
    const intent = await provider.createPaymentIntent({ orderId, amount: eur, idempotencyKey });
    assert.match(intent.id, /^pi_/);
    assert.ok((paymentIntentStatuses as readonly string[]).includes(intent.status));
    assert.deepEqual(intent.amount, eur);
    assert.match(intent.clientSecret ?? '', /_secret_/);
    const wire = last();
    assert.deepEqual([wire.method, wire.path, wire.idempotencyKey], ['POST', '/v1/payment_intents', idempotencyKey]);
    assert.equal(wire.body.get('amount'), '1250');
    assert.equal(wire.body.get('currency'), 'eur');
    assert.equal(wire.body.get('metadata[tazumo_order_id]'), orderId);
    assert.equal(wire.body.get('automatic_payment_methods[allow_redirects]'), 'never');
    assert.equal(wire.body.get('confirm'), null);
  });

  it('sends the same key on a retry for the same order', async () => {
    const idempotencyKey = pspIdempotencyKey(orderId, 'create');
    await provider.createPaymentIntent({ orderId, amount: eur, idempotencyKey });
    assert.equal(last().idempotencyKey, idempotencyKey);
  });

  it('confirms with an opaque ConfirmationToken or PaymentMethod id, and only that reaches the provider', async () => {
    const other = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
    await provider.createPaymentIntent({ orderId: other, amount: { currency: 'CZK', minorUnits: 31950 }, paymentMethodToken: 'ctoken_1Test', idempotencyKey: pspIdempotencyKey(other, 'create') });
    assert.deepEqual([last().body.get('confirm'), last().body.get('confirmation_token'), last().body.get('currency')], ['true', 'ctoken_1Test', 'czk']);
    const third = '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b';
    await provider.createPaymentIntent({ orderId: third, amount: eur, paymentMethodToken: 'pm_card_visa', idempotencyKey: pspIdempotencyKey(third, 'create') });
    assert.deepEqual([last().body.get('confirm'), last().body.get('payment_method')], ['true', 'pm_card_visa']);
    assert.ok(![...last().body.keys()].some((k) => /card\[|number|cvc|exp_/.test(k)));
  });

  it('maps a reused key with different parameters to idempotency_conflict without echoing the token (simulated by the proxy)', async () => {
    const idempotencyKey = pspIdempotencyKey(orderId, 'create');
    await assert.rejects(provider.createPaymentIntent({ orderId, amount: eur, paymentMethodToken: 'pm_card_visa', idempotencyKey }), (e: unknown) =>
      code('idempotency_conflict')(e) && !JSON.stringify([(e as Error).message, (e as PaymentError).details]).includes('pm_card_visa')
    );
  });

  it('retrieves by id; stripe-mock fixture data (USD) is refused against a EUR order', async () => {
    const intent = await provider.retrievePaymentIntent('pi_1RetrieveMe');
    assert.equal(intent.id, 'pi_1RetrieveMe');
    assert.deepEqual([last().method, last().path], ['GET', '/v1/payment_intents/pi_1RetrieveMe']);
    assert.equal(intent.amount.currency, 'USD');
    assert.throws(() => assertPaymentMatchesOrder(intent.amount, eur), code('currency_mismatch'));
  });

  it('cancels with its own idempotency key', async () => {
    const idempotencyKey = pspIdempotencyKey(orderId, 'cancel');
    const intent = await provider.cancelPaymentIntent('pi_1CancelMe', { idempotencyKey });
    assert.equal(intent.id, 'pi_1CancelMe');
    assert.deepEqual([last().method, last().path, last().idempotencyKey], ['POST', '/v1/payment_intents/pi_1CancelMe/cancel', idempotencyKey]);
  });
});
