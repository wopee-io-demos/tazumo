import type { BreakdownEntry, Money, OptionsError, PriceResult, PricingErrorCode, ProductOptions, Selection } from './types.ts';
import { isRecord, validateSelection } from './validate.ts';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Mirrors `MAX_LINE_QUANTITY` in `@tazumo/commerce`, so a line priced here is not rejected at the quote. */
export const MAX_LINE_QUANTITY = 999;

const fail = (code: PricingErrorCode, path: OptionsError['path'], message: string): PriceResult => ({
  ok: false,
  stage: 'pricing',
  errors: [{ code, path, message }]
});

/**
 * Validates the selection and prices one line with integer minor units only. `unitPrice` has the shape that
 * `@tazumo/commerce` expects for an order line, so the server can pass it on unchanged.
 */
export function priceSelection(def: ProductOptions, basePrice: Money, selection: Selection | undefined, quantity: number): PriceResult {
  const checked = validateSelection(def, selection);
  if (!checked.ok) return checked;

  const base: Record<string, unknown> = isRecord(basePrice) ? basePrice : {};
  const errors: OptionsError<PricingErrorCode>[] = [];
  if (!Number.isSafeInteger(base.minorUnits) || (base.minorUnits as number) < 0) {
    errors.push({ code: 'invalid_base_price', path: ['basePrice', 'minorUnits'], message: 'Base price must be a non-negative safe integer' });
  }
  if (base.currency !== def.currency) {
    errors.push({ code: 'currency_mismatch', path: ['basePrice', 'currency'], message: `Base price currency must be ${def.currency}` });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    errors.push({ code: 'invalid_quantity', path: ['quantity'], message: `Quantity must be an integer from 1 to ${MAX_LINE_QUANTITY}` });
  }
  if (errors.length) return { ok: false, stage: 'pricing', errors };

  const breakdown: BreakdownEntry[] = [];
  let unit = BigInt(base.minorUnits as number);
  for (const group of def.groups) {
    for (const optionId of checked.selection[group.id]) {
      const option = group.options.find((candidate) => candidate.id === optionId)!;
      breakdown.push({ groupId: group.id, optionId, labelKey: option.labelKey, priceDeltaMinor: option.priceDeltaMinor });
      unit += BigInt(option.priceDeltaMinor);
    }
  }
  if (unit < 0n) return fail('negative_unit_price', ['unitPrice'], 'Option deltas must not take the unit price below zero');
  if (unit > MAX_SAFE) return fail('amount_overflow', ['unitPrice'], 'Unit price exceeds the safe integer range');
  const line = unit * BigInt(quantity);
  if (line > MAX_SAFE) return fail('amount_overflow', ['lineTotal'], 'Line total exceeds the safe integer range');

  return {
    ok: true,
    selection: checked.selection,
    basePrice: { currency: def.currency, minorUnits: base.minorUnits as number },
    breakdown,
    unitPrice: { currency: def.currency, minorUnits: Number(unit) },
    quantity,
    lineTotal: { currency: def.currency, minorUnits: Number(line) }
  };
}
