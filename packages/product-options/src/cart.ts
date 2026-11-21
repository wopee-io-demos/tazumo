import { lineKey } from './line-key.ts';
import { priceSelection } from './price.ts';
import type { Money, PricedSelection, ProductOptions, ResolvedSelection, Selection } from './types.ts';
import { validateSelection } from './validate.ts';

/** What a cart needs to know about one product: its base price and its option groups, if it has any. */
export type CartProduct = { id: string; basePrice: Money; options?: ProductOptions };

export type PricedCartLine = PricedSelection & { key: string; productId: string; testKey: string; lineKey: string };

const definitionOf = (product: CartProduct): ProductOptions =>
  product.options ?? { productId: product.id, currency: product.basePrice.currency, groups: [] };

function defaultSelection(def: ProductOptions): ResolvedSelection | null {
  const result = validateSelection(def, {});
  return result.ok ? result.selection : null;
}

/**
 * Cart key for a resolved selection: the product ID for the product's default configuration (and for a product
 * without options), otherwise `lineKey`. Existing product-keyed carts therefore stay valid.
 */
export function cartKey(product: CartProduct, selection: ResolvedSelection): string {
  const defaults = defaultSelection(definitionOf(product));
  return defaults && lineKey(product.id, defaults) === lineKey(product.id, selection) ? product.id : lineKey(product.id, selection);
}

/** Inverse of `cartKey`. A product ID key means the default configuration. Returns undefined for a malformed key. */
export function parseCartKey(key: string): { productId: string; selection?: Selection } | undefined {
  if (!key.startsWith('[')) return key ? { productId: key } : undefined;
  let value: unknown;
  try {
    value = JSON.parse(key);
  } catch {
    return undefined;
  }
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !Array.isArray(value[1])) return undefined;
  const selection: Record<string, string[]> = {};
  for (const entry of value[1] as unknown[]) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1]) || !entry[1].every((id) => typeof id === 'string')) return undefined;
    selection[entry[0]] = entry[1];
  }
  return { productId: value[0], selection };
}

/**
 * Readable, stable suffix for test IDs: the product ID for the default configuration, otherwise the product ID
 * followed by the chosen option IDs in definition order, or `none` when nothing is chosen.
 */
export function lineTestKey(product: CartProduct, selection: ResolvedSelection): string {
  if (cartKey(product, selection) === product.id) return product.id;
  const chosen = definitionOf(product).groups.flatMap((group) => selection[group.id]);
  return `${product.id}-${chosen.length ? chosen.join('-') : 'none'}`;
}

/**
 * Prices every cart entry with a positive quantity, in cart order. Malformed or non-canonical keys, unknown products
 * and selections that no longer validate (for example an option that became unavailable) are left out. The quantity
 * is not capped here; the server enforces its line limit when it quotes.
 */
export function priceCartLines(cart: Readonly<Record<string, number>>, find: (productId: string) => CartProduct | undefined): PricedCartLine[] {
  const lines: PricedCartLine[] = [];
  for (const [key, quantity] of Object.entries(cart)) {
    if (!(quantity > 0)) continue;
    const parsed = parseCartKey(key);
    const product = parsed && find(parsed.productId);
    if (!parsed || !product) continue;
    const priced = priceSelection(definitionOf(product), product.basePrice, parsed.selection, 1);
    if (!priced.ok || cartKey(product, priced.selection) !== key || !Number.isSafeInteger(quantity)) continue;
    const total = priced.unitPrice.minorUnits * quantity;
    if (!Number.isSafeInteger(total)) continue;
    lines.push({
      ...priced,
      quantity,
      lineTotal: { ...priced.unitPrice, minorUnits: total },
      key,
      productId: product.id,
      testKey: lineTestKey(product, priced.selection),
      lineKey: lineKey(product.id, priced.selection)
    });
  }
  return lines;
}
