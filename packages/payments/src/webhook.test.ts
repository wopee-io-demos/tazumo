import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { PaymentError, assertPaymentMatchesOrder, createMemoryReplayGuard, paymentActor, processStripeWebhook, verifyStripeSignature, type CommandOutcome, type ReplayGuard } from './index.ts';

const code = (c: string) => (e: unknown) => e instanceof PaymentError && e.code === c;
const newSecret = () => `whsec_${randomBytes(24).toString('base64url')}`;
const secret = newSecret();
const now = 1_790_000_000_000;
const orderId = '0b9e3c1a-6f1d-4e7a-9a7b-2f4c5d6e7f80';

function event(type: string, intent: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: `evt_${randomBytes(12).toString('hex')}`,
    object: 'event',
    type,
    livemode: false,
    data: {
      object: { id: 'pi_3Q0abcDEF', object: 'payment_intent', livemode: false, amount: 1250, currency: 'eur', metadata: { tazumo_order_id: orderId }, ...intent }
    },
    ...extra
  });
}
const sign = (payload: string, opts: { at?: number; key?: string } = {}) =>
  Stripe.webhooks.generateTestHeaderString({ payload, secret: opts.key ?? secret, timestamp: Math.floor((opts.at ?? now) / 1000) });
const applied: CommandOutcome[] = [];
const record = async (o: CommandOutcome): Promise<void> => void applied.push(o);
const deliver = (rawBody: string | Uint8Array, signatureHeader: string | undefined, replayGuard: ReplayGuard = createMemoryReplayGuard(), apply = record) =>
  processStripeWebhook({ rawBody, signatureHeader, secret, now: () => now, replayGuard, apply });

describe('Stripe webhook signature', () => {
  it('accepts a payload signed by the Stripe SDK and maps payment_intent.succeeded to payment_authorized', async () => {
    const body = event('payment_intent.succeeded');
    const outcome = await deliver(body, sign(body));
    assert.equal(outcome.kind, 'command');
    if (outcome.kind !== 'command') return;
    assert.deepEqual(outcome.command, { type: 'payment_authorized', paymentReference: 'pi_3Q0abcDEF' });
    assert.equal(outcome.orderId, orderId);
    assert.equal(outcome.idempotencyKey, `stripe-${JSON.parse(body).id}`);
    assert.match(outcome.idempotencyKey, /^[A-Za-z0-9_-]{8,128}$/);
    assert.deepEqual(outcome.amount, { currency: 'EUR', minorUnits: 1250 });
    assert.deepEqual(paymentActor, { kind: 'system', source: 'payment' });
  });

  it('maps payment_intent.payment_failed to payment_failed with a safe reason', async () => {
    const declined = event('payment_intent.payment_failed', { last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' } });
    const odd = event('payment_intent.payment_failed', { last_payment_error: { code: 'Card <b>declined</b>', decline_code: '_leading' } });
    const a = await deliver(declined, sign(declined));
    const b = await deliver(odd, sign(odd));
    assert.deepEqual(a.kind === 'command' && a.command, { type: 'payment_failed', reason: 'insufficient_funds' });
    assert.deepEqual(b.kind === 'command' && b.command, { type: 'payment_failed', reason: 'payment_failed' });
  });

  it('verifies the raw bytes, including non-ASCII content, and accepts a rotated secret', async () => {
    const body = event('payment_intent.succeeded', { description: 'Pizzeria Šťastná, Köln' });
    assert.equal((await deliver(Buffer.from(body, 'utf8'), sign(body))).kind, 'command');
    const rotated = `${sign(body, { key: newSecret() })},${sign(body).split(',')[1]}`;
    assert.equal((await deliver(body, rotated)).kind, 'command');
  });

  it('ignores event types that do not drive orders', async () => {
    const body = event('payment_intent.created');
    assert.deepEqual(await deliver(body, sign(body)), { kind: 'ignored', eventId: JSON.parse(body).id, eventType: 'payment_intent.created' });
  });

  it('rejects a bad signature or a tampered body without touching the replay guard', async () => {
    const body = event('payment_intent.succeeded');
    let touched = 0;
    const guard: ReplayGuard = { once: async () => (touched++, true) };
    const before = applied.length;
    await assert.rejects(deliver(body, sign(body, { key: newSecret() }), guard), code('signature_mismatch'));
    await assert.rejects(deliver(body.replace('1250', '1'), sign(body), guard), code('signature_mismatch'));
    assert.equal(touched, 0);
    assert.equal(applied.length, before);
  });

  it('rejects missing and malformed headers', async () => {
    const body = event('payment_intent.succeeded');
    await assert.rejects(deliver(body, undefined), code('signature_missing'));
    await assert.rejects(deliver(body, ''), code('signature_missing'));
    for (const header of ['garbage', 't=abc,v1=00', `t=${now / 1000}`, `v1=${'0'.repeat(64)}`, `t=1,t=2,v1=${'0'.repeat(64)}`]) {
      await assert.rejects(deliver(body, header), code('signature_malformed'), header);
    }
  });

  it('rejects timestamps outside the tolerance in either direction', async () => {
    const body = event('payment_intent.succeeded');
    await assert.rejects(deliver(body, sign(body, { at: now - 301_000 })), code('timestamp_outside_tolerance'));
    await assert.rejects(deliver(body, sign(body, { at: now + 301_000 })), code('timestamp_outside_tolerance'));
    assert.equal((await deliver(body, sign(body, { at: now - 300_000 }))).kind, 'command');
  });

  it('rejects a parsed body, since the signature covers the raw bytes', async () => {
    const body = event('payment_intent.succeeded');
    await assert.rejects(deliver(JSON.parse(body), sign(body)), code('payload_not_raw'));
  });

  it('rejects invalid secrets and tolerances', () => {
    const body = event('payment_intent.succeeded');
    for (const s of ['', 'sk_test_123', 'whsec_']) {
      assert.throws(() => verifyStripeSignature({ rawBody: body, signatureHeader: sign(body), secret: s }), code('invalid_webhook_secret'));
    }
    for (const toleranceSeconds of [0, -1, 1.5, 3600]) {
      assert.throws(() => verifyStripeSignature({ rawBody: body, signatureHeader: sign(body), secret, toleranceSeconds }), code('invalid_tolerance'));
    }
  });
});

describe('Stripe webhook events', () => {
  it('returns duplicate for a replayed event, so no second command is applied', async () => {
    const body = event('payment_intent.succeeded');
    const guard = createMemoryReplayGuard();
    const before = applied.length;
    assert.equal((await deliver(body, sign(body), guard)).kind, 'command');
    assert.deepEqual(await deliver(body, sign(body), guard), { kind: 'duplicate', eventId: JSON.parse(body).id });
    assert.equal(applied.length, before + 1);
  });

  it('records nothing when applying fails, so the provider retry is applied', async () => {
    const body = event('payment_intent.succeeded', { currency: 'czk' });
    const guard = createMemoryReplayGuard();
    const strict = async (o: CommandOutcome) => assertPaymentMatchesOrder(o.amount, { currency: 'EUR', minorUnits: 1250 });
    await assert.rejects(deliver(body, sign(body), guard, strict), code('currency_mismatch'));
    assert.equal((await deliver(body, sign(body), guard)).kind, 'command');
  });

  it('refuses live-mode events and objects', async () => {
    const liveEvent = event('payment_intent.succeeded', {}, { livemode: true });
    const liveIntent = event('payment_intent.succeeded', { livemode: true });
    await assert.rejects(deliver(liveEvent, sign(liveEvent)), code('live_mode'));
    await assert.rejects(deliver(liveIntent, sign(liveIntent)), code('live_mode'));
  });

  it('rejects a payment in another currency than the order', async () => {
    const body = event('payment_intent.succeeded', { currency: 'czk' });
    const outcome = await deliver(body, sign(body));
    assert.ok(outcome.kind === 'command');
    assert.throws(() => assertPaymentMatchesOrder(outcome.amount, { currency: 'EUR', minorUnits: 1250 }), code('currency_mismatch'));
    assert.throws(() => assertPaymentMatchesOrder(outcome.amount, { currency: 'CZK', minorUnits: 125000 }), code('amount_mismatch'));
    const zeroDecimal = event('payment_intent.succeeded', { currency: 'jpy' });
    await assert.rejects(deliver(zeroDecimal, sign(zeroDecimal)), code('unsupported_currency'));
  });

  it('rejects events without a Tazumo order reference or PaymentIntent', async () => {
    const noOrder = event('payment_intent.succeeded', { metadata: {} });
    const notIntent = event('payment_intent.succeeded', { object: 'charge' });
    const notEvent = JSON.stringify({ id: 'evt_1', object: 'list' });
    await assert.rejects(deliver(noOrder, sign(noOrder)), code('missing_order_reference'));
    await assert.rejects(deliver(notIntent, sign(notIntent)), code('payload_invalid'));
    await assert.rejects(deliver(notEvent, sign(notEvent)), code('payload_invalid'));
    await assert.rejects(deliver('not json', sign('not json')), code('payload_invalid'));
  });

  it('never puts the secret or signature into errors', async () => {
    const body = event('payment_intent.succeeded');
    const header = sign(body, { at: now - 999_000 });
    await assert.rejects(deliver(body, header), (e: unknown) => {
      const text = `${(e as Error).message} ${JSON.stringify((e as PaymentError).details)}`;
      return !text.includes(secret) && !text.includes(header.split('v1=')[1]);
    });
  });
});
