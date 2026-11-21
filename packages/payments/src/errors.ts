export type PaymentErrorCode =
  | 'live_key_refused'
  | 'invalid_key'
  | 'invalid_endpoint'
  | 'invalid_webhook_secret'
  | 'invalid_tolerance'
  | 'unsupported_currency'
  | 'invalid_amount'
  | 'currency_mismatch'
  | 'amount_mismatch'
  | 'invalid_token'
  | 'invalid_order_id'
  | 'invalid_payment_reference'
  | 'invalid_idempotency_key'
  | 'idempotency_conflict'
  | 'card_declined'
  | 'provider_rejected'
  | 'provider_auth'
  | 'provider_unavailable'
  | 'invalid_provider_response'
  | 'live_mode'
  | 'signature_missing'
  | 'signature_malformed'
  | 'signature_mismatch'
  | 'timestamp_outside_tolerance'
  | 'payload_not_raw'
  | 'payload_invalid'
  | 'missing_order_reference';

/** Messages and details never carry keys, tokens, client secrets or provider messages. */
export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(code: PaymentErrorCode, message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.details = details;
  }
}
