import { markets, type Money } from '@tazumo/commerce';
import { PaymentError } from './errors.ts';

/** Currencies Tazumo charges in: exactly the @tazumo/commerce market currencies. */
export const supportedCurrencies: ReadonlySet<string> = new Set(Object.values(markets).map((m) => m.currency));

const twoDecimal = (currency: string): boolean => {
  if (!/^[A-Z]{3}$/.test(currency)) return false;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits === 2;
  } catch {
    return false;
  }
};

/** Stripe's largest accepted amount (eight digits). Per-currency minimum charges are left to Stripe (`provider_rejected`). */
export const MAX_STRIPE_AMOUNT = 99_999_999;

const isMinorUnits = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Stripe amounts are integers in the currency's smallest unit, which equals minor units for two-decimal currencies. */
export function toStripeAmount(money: Money): { amount: number; currency: string } {
  if (typeof money?.currency !== 'string' || !supportedCurrencies.has(money.currency)) {
    throw new PaymentError('unsupported_currency', 'currency is not a Tazumo market currency');
  }
  if (!isMinorUnits(money.minorUnits) || money.minorUnits === 0 || money.minorUnits > MAX_STRIPE_AMOUNT) {
    throw new PaymentError('invalid_amount', 'amount must be a positive integer in minor units up to 99,999,999');
  }
  return { amount: money.minorUnits, currency: money.currency.toLowerCase() };
}

export function fromStripeAmount(amount: unknown, currency: unknown): Money {
  const code = typeof currency === 'string' ? currency.toUpperCase() : '';
  if (!twoDecimal(code)) throw new PaymentError('unsupported_currency', 'provider currency is not a two-decimal ISO 4217 currency');
  if (!isMinorUnits(amount)) throw new PaymentError('invalid_provider_response', 'provider amount is not a non-negative safe integer');
  return { currency: code, minorUnits: amount };
}

/** A payment settles an order only for exactly the order total in the order currency. */
export function assertPaymentMatchesOrder(paid: Money, orderTotal: Money): void {
  if (paid.currency !== orderTotal.currency) {
    throw new PaymentError('currency_mismatch', 'payment currency differs from the order currency', {
      paid: paid.currency,
      order: orderTotal.currency
    });
  }
  if (paid.minorUnits !== orderTotal.minorUnits) throw new PaymentError('amount_mismatch', 'payment amount differs from the order total');
}
