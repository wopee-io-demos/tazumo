import type { BreakdownEntry, Money, OptionsError, PriceResult, PricingErrorCode, ProductOptions, Selection } from './types.ts';
import { isRecord, validateSelection } from './validate.ts';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const fail = (code: PricingErrorCode, path: OptionsError['path'], message: string): PriceResult => ({
  ok: false,
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
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    errors.push({ code: 'invalid_quantity', path: ['quantity'], message: 'Quantity must be a positive safe integer' });
  }
  if (errors.length) return { ok: false, errors };

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
