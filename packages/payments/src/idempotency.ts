import { PaymentError } from './errors.ts';

/** Same shape @tazumo/orders accepts for command idempotency keys (PR #105). Stripe allows up to 255 characters. */
export const idempotencyKeyPattern = /^[A-Za-z0-9_-]{8,128}$/;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type PspOperation = 'create' | 'cancel';

export function assertIdempotencyKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !idempotencyKeyPattern.test(key)) {
    throw new PaymentError('invalid_idempotency_key', 'idempotency key must be 8 to 128 characters of [A-Za-z0-9_-]');
  }
}

export function assertOrderId(orderId: unknown): asserts orderId is string {
  if (typeof orderId !== 'string' || !uuidPattern.test(orderId)) throw new PaymentError('invalid_order_id', 'order id must be a lower-case UUID');
}

/**
 * One provider key per order and operation, so a retried API request (same order) reuses the provider's stored
 * response instead of creating a second PaymentIntent.
 */
export function pspIdempotencyKey(orderId: string, operation: PspOperation): string {
  assertOrderId(orderId);
  return `tazumo-${operation}-${orderId}`;
}
