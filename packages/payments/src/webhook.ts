import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Money } from '@tazumo/commerce';
import { PaymentError } from './errors.ts';
import { uuidPattern } from './idempotency.ts';
import { fromStripeAmount } from './money.ts';
import { ORDER_METADATA_KEY, paymentIntentIdPattern } from './port.ts';

/** The payment commands of @tazumo/orders (PR #105), applied with a system `payment` actor. */
export type PaymentCommand = { type: 'payment_authorized'; paymentReference: string } | { type: 'payment_failed'; reason: string };
export const paymentActor = Object.freeze({ kind: 'system', source: 'payment' } as const);

export type WebhookOutcome =
  | { kind: 'command'; eventId: string; orderId: string; idempotencyKey: string; command: PaymentCommand; amount: Money }
  | { kind: 'ignored'; eventId: string; eventType: string }
  | { kind: 'duplicate'; eventId: string };

/**
 * Records delivered event ids. In the API this must write in the same transaction that applies the command,
 * so a rolled-back delivery is not marked as seen.
 */
export interface ReplayGuard {
  /** Returns true the first time an event id is seen, false for every later delivery. */
  firstSeen(eventId: string): boolean | Promise<boolean>;
}

export function createMemoryReplayGuard(): ReplayGuard {
  const seen = new Set<string>();
  return { firstSeen: (id) => (seen.has(id) ? false : (seen.add(id), true)) };
}

export const DEFAULT_TOLERANCE_SECONDS = 300;
const eventIdPattern = /^evt_[A-Za-z0-9]{1,100}$/;
const reasonPattern = /^[a-z_]{1,64}$/;

export type VerifyInput = {
  /** The exact request bytes as received, before any JSON parsing. */
  rawBody: Uint8Array | string;
  signatureHeader: string | undefined;
  secret: string;
  toleranceSeconds?: number;
  /** Current time in milliseconds; injectable for tests. */
  now?: () => number;
};

/** Stripe's `Stripe-Signature` scheme: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.rawBody">`, several v1 during secret rotation. */
export function verifyStripeSignature(input: VerifyInput): unknown {
  const { secret } = input;
  if (typeof secret !== 'string' || !/^whsec_\S{8,}$/.test(secret)) throw new PaymentError('invalid_webhook_secret', 'webhook secret must be a whsec_ value');
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isInteger(tolerance) || tolerance < 1 || tolerance > 600) throw new PaymentError('invalid_tolerance', 'tolerance must be 1 to 600 seconds');
  const raw = typeof input.rawBody === 'string' ? Buffer.from(input.rawBody, 'utf8') : input.rawBody instanceof Uint8Array ? Buffer.from(input.rawBody) : null;
  if (!raw) throw new PaymentError('payload_not_raw', 'verify the raw request body, not a parsed object');
  const header = input.signatureHeader;
  if (typeof header !== 'string' || header.length === 0) throw new PaymentError('signature_missing', 'Stripe-Signature header is missing');

  let timestamp: number | undefined;
  const signatures: Buffer[] = [];
  for (const part of header.split(',')) {
    const [name, value, ...rest] = part.trim().split('=');
    if (rest.length || value === undefined) throw new PaymentError('signature_malformed', 'Stripe-Signature header is malformed');
    if (name === 't') {
      if (timestamp !== undefined || !/^\d{1,12}$/.test(value)) throw new PaymentError('signature_malformed', 'Stripe-Signature timestamp is malformed');
      timestamp = Number(value);
    } else if (name === 'v1' && /^[0-9a-f]{64}$/.test(value)) signatures.push(Buffer.from(value, 'hex'));
  }
  if (timestamp === undefined || signatures.length === 0) throw new PaymentError('signature_malformed', 'Stripe-Signature needs t and v1');

  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  if (!signatures.some((s) => timingSafeEqual(s, expected))) throw new PaymentError('signature_mismatch', 'webhook signature does not match');
  const nowSeconds = Math.floor((input.now ?? Date.now)() / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) throw new PaymentError('timestamp_outside_tolerance', 'webhook timestamp is outside the tolerance');

  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new PaymentError('payload_invalid', 'webhook body is not JSON');
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Maps a verified Stripe event to an orders command. Only PaymentIntent outcomes drive orders; other types are ignored. */
export function mapStripeEvent(event: unknown): Exclude<WebhookOutcome, { kind: 'duplicate' }> {
  if (!isObject(event) || event.object !== 'event' || typeof event.id !== 'string' || !eventIdPattern.test(event.id) || typeof event.type !== 'string') {
    throw new PaymentError('payload_invalid', 'not a Stripe event');
  }
  if (event.livemode !== false) throw new PaymentError('live_mode', 'live-mode events are refused');
  const eventId = event.id;
  if (event.type !== 'payment_intent.succeeded' && event.type !== 'payment_intent.payment_failed') {
    return { kind: 'ignored', eventId, eventType: event.type };
  }
  const intent = isObject(event.data) ? event.data.object : undefined;
  if (!isObject(intent) || intent.object !== 'payment_intent' || typeof intent.id !== 'string' || !paymentIntentIdPattern.test(intent.id)) {
    throw new PaymentError('payload_invalid', 'event carries no PaymentIntent');
  }
  if (intent.livemode !== false) throw new PaymentError('live_mode', 'live-mode objects are refused');
  const orderId = isObject(intent.metadata) ? intent.metadata[ORDER_METADATA_KEY] : undefined;
  if (typeof orderId !== 'string' || !uuidPattern.test(orderId)) throw new PaymentError('missing_order_reference', 'PaymentIntent has no Tazumo order id');
  const amount = fromStripeAmount(intent.amount, intent.currency);

  let command: PaymentCommand;
  if (event.type === 'payment_intent.succeeded') {
    command = { type: 'payment_authorized', paymentReference: intent.id };
  } else {
    const error = isObject(intent.last_payment_error) ? intent.last_payment_error : {};
    const code = [error.decline_code, error.code].find((c) => typeof c === 'string' && reasonPattern.test(c));
    command = { type: 'payment_failed', reason: typeof code === 'string' ? code : 'payment_failed' };
  }
  return { kind: 'command', eventId, orderId, idempotencyKey: `stripe-${eventId}`, command, amount };
}

/** Verify, map and de-duplicate one webhook delivery. The caller then checks the amount against the order total. */
export async function processStripeWebhook(input: VerifyInput & { replayGuard: ReplayGuard }): Promise<WebhookOutcome> {
  const outcome = mapStripeEvent(verifyStripeSignature(input));
  if (!(await input.replayGuard.firstSeen(outcome.eventId))) return { kind: 'duplicate', eventId: outcome.eventId };
  return outcome;
}
