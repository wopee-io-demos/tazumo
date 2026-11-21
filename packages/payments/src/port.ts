import type { Money } from '@tazumo/commerce';

export const ORDER_METADATA_KEY = 'tazumo_order_id';
export const paymentIntentIdPattern = /^pi_[A-Za-z0-9]{1,120}$/;

export const paymentIntentStatuses = Object.freeze([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'requires_capture',
  'succeeded',
  'canceled'
] as const);
export type PaymentIntentStatus = (typeof paymentIntentStatuses)[number];

export type CreatePaymentIntentInput = {
  orderId: string;
  amount: Money;
  /**
   * Opaque token created on the client by the provider's own UI (a Stripe ConfirmationToken `ctoken_…` or
   * PaymentMethod `pm_…`). Card numbers never reach Tazumo. Without a token the intent is created unconfirmed.
   */
  paymentMethodToken?: string;
  idempotencyKey: string;
};

export type PaymentIntentView = {
  id: string;
  status: PaymentIntentStatus;
  amount: Money;
  orderId: string | null;
  /** Lets the client finish 3-D Secure. Return it to the paying customer only; never log or store it. */
  clientSecret: string | null;
};

/** Payment service provider port. Adapters are test-mode only in this repository. */
export interface PaymentProvider {
  readonly provider: 'stripe';
  readonly mode: 'test';
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentView>;
  retrievePaymentIntent(id: string): Promise<PaymentIntentView>;
  cancelPaymentIntent(id: string, options: { idempotencyKey: string }): Promise<PaymentIntentView>;
}
