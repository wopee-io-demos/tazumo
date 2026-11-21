import type { Selection } from './types.ts';
import { isRecord } from './validate.ts';

/**
 * Canonical cart-line key, independent of group and option order. Pass the resolved selection returned by
 * `validateSelection` or `priceSelection`: a raw selection that leaves a group out (defaults apply) and one that
 * lists it as empty are different configurations and get different keys.
 */
export function lineKey(productId: string, selection: Selection): string {
  if (typeof productId !== 'string' || productId.length === 0) throw new TypeError('productId must be a non-empty string');
  if (!isRecord(selection)) throw new TypeError('selection must be an object');
  const entries = Object.keys(selection)
    .sort()
    .map((groupId) => {
      const ids: unknown = selection[groupId];
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
        throw new TypeError(`selection.${groupId} must be an array of option IDs`);
      }
      return [groupId, [...ids].sort()];
    });
  return JSON.stringify([productId, entries]);
}
