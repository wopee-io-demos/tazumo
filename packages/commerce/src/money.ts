import { CommerceRuleError } from './errors.ts';
import type { MarketConfig } from './markets.ts';

/** Same shape as the OpenAPI `Money` schema: ISO 4217 code plus integer minor units. */
export type Money = { currency: string; minorUnits: number };

/** Rounds num / den half away from zero, using exact integer arithmetic. */
export function divideRoundHalfUp(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new RangeError('denominator must be positive');
  const sign = num < 0n ? -1n : 1n;
  const abs = num * sign;
  return sign * ((2n * abs + den) / (2n * den));
}

export function toSafeNumber(value: bigint, what: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new CommerceRuleError('amount_overflow', `${what} exceeds the safe integer range`, { what });
  }
  return Number(value);
}

export function roundToIncrement(minor: number, increment: number): number {
  return toSafeNumber(divideRoundHalfUp(BigInt(minor), BigInt(increment)) * BigInt(increment), 'rounded amount');
}

/**
 * Formats minor units for the market locale. With `wholeUnitDisplay` (CZK), whole-crown amounts are shown
 * without a fraction; amounts that are not whole crowns (such as VAT) keep two decimals so nothing is hidden.
 */
export function formatMinor(market: MarketConfig, minor: number): string {
  const digits = market.rounding.wholeUnitDisplay && minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(minor / 100);
}

export const formatPercent = (basisPoints: number): string => `${(basisPoints / 100).toString()} %`;
