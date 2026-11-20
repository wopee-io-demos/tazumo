export type CommerceErrorCode =
  | 'unknown_market'
  | 'invalid_market_config'
  | 'empty_order'
  | 'too_many_lines'
  | 'invalid_line'
  | 'duplicate_line'
  | 'invalid_quantity'
  | 'invalid_amount'
  | 'currency_mismatch'
  | 'unknown_vat_category'
  | 'unknown_vat_rate'
  | 'invalid_distance'
  | 'outside_delivery_area'
  | 'amount_overflow';

export class CommerceRuleError extends Error {
  readonly code: CommerceErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: CommerceErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CommerceRuleError';
    this.code = code;
    this.details = details;
  }
}
