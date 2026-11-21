import Stripe from 'stripe';
import { PaymentError } from './errors.ts';
import { assertIdempotencyKey, assertOrderId, uuidPattern } from './idempotency.ts';
import { fromStripeAmount, toStripeAmount } from './money.ts';
import { ORDER_METADATA_KEY, paymentIntentIdPattern, paymentIntentStatuses, type CreatePaymentIntentInput, type PaymentIntentStatus, type PaymentIntentView, type PaymentProvider } from './port.ts';

const tokenPattern = /^(ctoken|pm)_[A-Za-z0-9_]{1,200}$/;

export type StripeTestConfig = {
  secretKey: string;
  /** Only for stripe-mock or another local stand-in; omit to use api.stripe.com. Plain http is allowed for loopback hosts only. */
  endpoint?: { host: string; port: number; protocol: 'http' | 'https' };
  timeoutMs?: number;
  maxNetworkRetries?: number;
};

/** Refuses anything but a test-mode secret or restricted key, so a live key can never run. */
export function assertTestModeKey(key: unknown): asserts key is string {
  if (typeof key === 'string' && /^(sk|rk)_live_/.test(key)) throw new PaymentError('live_key_refused', 'live-mode Stripe keys are refused');
  if (typeof key !== 'string' || !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key)) {
    throw new PaymentError('invalid_key', 'expected a Stripe test-mode secret (sk_test_) or restricted (rk_test_) key');
  }
}

function assertPaymentIntentId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !paymentIntentIdPattern.test(id)) throw new PaymentError('invalid_payment_reference', 'not a PaymentIntent id');
}

export function toView(intent: Stripe.PaymentIntent): PaymentIntentView {
  if (intent.livemode !== false) throw new PaymentError('live_mode', 'provider returned a live-mode object');
  assertPaymentIntentId(intent.id);
  const status = intent.status as string;
  if (!(paymentIntentStatuses as readonly string[]).includes(status)) throw new PaymentError('invalid_provider_response', 'unknown PaymentIntent status');
  const reference = intent.metadata?.[ORDER_METADATA_KEY];
  const orderId = typeof reference === 'string' && uuidPattern.test(reference) ? reference : null;
  return {
    id: intent.id,
    status: status as PaymentIntentStatus,
    amount: fromStripeAmount(intent.amount, intent.currency),
    orderId,
    clientSecret: intent.client_secret ?? null
  };
}

function mapError(error: unknown): PaymentError {
  if (error instanceof PaymentError) return error;
  if (!(error instanceof Stripe.errors.StripeError)) return new PaymentError('provider_unavailable', 'payment provider call failed');
  const details: Record<string, string> = {};
  if (typeof error.code === 'string') details.providerCode = error.code;
  if (typeof error.requestId === 'string') details.requestId = error.requestId;
  switch (error.type) {
    case 'StripeCardError':
      return new PaymentError('card_declined', 'the card was declined', details);
    case 'StripeIdempotencyError':
      return new PaymentError('idempotency_conflict', 'idempotency key reused with different parameters', details);
    case 'StripeInvalidRequestError':
      return new PaymentError('provider_rejected', 'the payment provider rejected the request', details);
    case 'StripeAuthenticationError':
    case 'StripePermissionError':
      return new PaymentError('provider_auth', 'the payment provider refused the credentials', details);
    default:
      return new PaymentError('provider_unavailable', 'payment provider call failed', details);
  }
}

async function call(run: () => Promise<Stripe.PaymentIntent>): Promise<PaymentIntentView> {
  let intent: Stripe.PaymentIntent;
  try {
    intent = await run();
  } catch (error) {
    throw mapError(error);
  }
  return toView(intent);
}

export function createStripeTestProvider(config: StripeTestConfig): PaymentProvider {
  assertTestModeKey(config?.secretKey);
  const endpoint = config.endpoint;
  if (endpoint && endpoint.protocol !== 'https' && !['127.0.0.1', 'localhost', '::1'].includes(endpoint.host)) {
    throw new PaymentError('invalid_endpoint', 'plain http is allowed only for a loopback stripe-mock');
  }
  const client = new Stripe(config.secretKey, {
    ...(endpoint ?? {}),
    timeout: config.timeoutMs ?? 10_000,
    maxNetworkRetries: config.maxNetworkRetries ?? 2,
    telemetry: false,
    appInfo: { name: 'tazumo-payments' }
  });

  return {
    provider: 'stripe',
    mode: 'test',
    async createPaymentIntent(input: CreatePaymentIntentInput) {
      assertOrderId(input?.orderId);
      assertIdempotencyKey(input.idempotencyKey);
      const { amount, currency } = toStripeAmount(input.amount);
      const token = input.paymentMethodToken;
      if (token !== undefined && (typeof token !== 'string' || !tokenPattern.test(token))) {
        throw new PaymentError('invalid_token', 'expected an opaque Stripe ConfirmationToken or PaymentMethod id');
      }
      const params: Stripe.PaymentIntentCreateParams = {
        amount,
        currency,
        capture_method: 'automatic',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { [ORDER_METADATA_KEY]: input.orderId }
      };
      if (token?.startsWith('ctoken_')) Object.assign(params, { confirm: true, confirmation_token: token });
      else if (token) Object.assign(params, { confirm: true, payment_method: token });
      return call(() => client.paymentIntents.create(params, { idempotencyKey: input.idempotencyKey }));
    },
    async retrievePaymentIntent(id: string) {
      assertPaymentIntentId(id);
      return call(() => client.paymentIntents.retrieve(id));
    },
    async cancelPaymentIntent(id: string, options: { idempotencyKey: string }) {
      assertPaymentIntentId(id);
      assertIdempotencyKey(options?.idempotencyKey);
      return call(() => client.paymentIntents.cancel(id, {}, { idempotencyKey: options.idempotencyKey }));
    }
  };
}
