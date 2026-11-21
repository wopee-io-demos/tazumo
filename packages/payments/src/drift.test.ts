import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { createMemoryReplayGuard, idempotencyKeyPattern, paymentActor, processStripeWebhook } from './index.ts';

const repo = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, repo), 'utf8');
const orders = 'packages/orders/src/index.ts';
const ordersMissing = !existsSync(new URL(orders, repo)) && '@tazumo/orders is not on this branch yet (PR #105)';

describe('drift against the contract', () => {
  const schemas = JSON.parse(read('contracts/openapi.json')).components.schemas;

  it('uses the contract Money shape', () => {
    assert.deepEqual([...schemas.Money.required].sort(), ['currency', 'minorUnits']);
    assert.equal(schemas.Money.properties.minorUnits.type, 'integer');
    assert.equal(schemas.Money.additionalProperties, false);
  });

  it('takes only a quote id and an opaque token for order creation, so raw card fields are rejected', () => {
    assert.deepEqual(Object.keys(schemas.CreateOrderRequest.properties).sort(), ['paymentMethodToken', 'quoteId']);
    assert.equal(schemas.CreateOrderRequest.additionalProperties, false);
  });
});

describe('drift against @tazumo/orders', () => {
  it('matches the payment command shapes and key pattern', { skip: ordersMissing }, () => {
    const types = read('packages/orders/src/types.ts');
    assert.ok(types.includes("{ type: 'payment_authorized'; paymentReference: string }"));
    assert.ok(types.includes("{ type: 'payment_failed'; reason: string }"));
    assert.match(types, /systemSources = Object\.freeze\(\[[^\]]*'payment'/);
    assert.ok(read('packages/orders/src/machine.ts').includes(`const idempotencyKey = ${idempotencyKeyPattern};`));
  });

  it('drives an order from payment_pending to confirmed, and a replay appends nothing', { skip: ordersMissing }, async () => {
    const o = await import(new URL(orders, repo).href);
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    const orderId = globalThis.crypto.randomUUID();
    const total = { currency: 'EUR', minorUnits: 1250 };
    const customer = { kind: 'user', principal: { userId: globalThis.crypto.randomUUID(), grants: [{ role: 'customer', merchantId: null }] } };
    const at = '2026-11-21T10:00:00.000Z';
    const created = o.createOrder({ orderId, merchantId: globalThis.crypto.randomUUID(), total }, customer, at, 'create-order-1');
    assert.ok(created.ok, JSON.stringify(created));
    const events = [created.value.event];
    const requested = o.applyCommand(events, { type: 'request_payment' }, paymentActor, at, 'request-payment-1');
    assert.ok(requested.ok, JSON.stringify(requested));
    events.push(requested.value.event);

    const payload = JSON.stringify({
      id: 'evt_1Drift',
      object: 'event',
      type: 'payment_intent.succeeded',
      livemode: false,
      data: { object: { id: 'pi_1Drift', object: 'payment_intent', livemode: false, amount: 1250, currency: 'eur', metadata: { tazumo_order_id: orderId } } }
    });
    const signatureHeader = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const outcome = await processStripeWebhook({ rawBody: payload, signatureHeader, secret, replayGuard: createMemoryReplayGuard() });
    assert.ok(outcome.kind === 'command');
    const applied = o.applyCommand(events, outcome.command, paymentActor, at, outcome.idempotencyKey);
    assert.ok(applied.ok, JSON.stringify(applied));
    assert.equal(applied.value.state.status, 'confirmed');
    assert.equal(applied.value.state.paymentReference, 'pi_1Drift');
    events.push(applied.value.event);
    const again = o.applyCommand(events, outcome.command, paymentActor, at, outcome.idempotencyKey);
    assert.ok(again.ok && again.value.replayed);
  });
});
