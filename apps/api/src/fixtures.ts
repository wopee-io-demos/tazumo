import { createHash } from 'node:crypto';
import { categories, products } from '@tazumo/core';
import type { VatCategory } from '@tazumo/commerce';
import { validateOptionGroups, type OptionGroup } from '@tazumo/product-options';
import { syntheticProductOptions } from '@tazumo/product-options/fixtures';

export const fixtureNamespace = '6f1c2b9e-4d1a-5c3e-9b7a-2d8e0f4a6c11';

export function uuidV5(name: string, namespace: string = fixtureNamespace): string {
  const hash = createHash('sha1').update(Buffer.from(namespace.replaceAll('-', ''), 'hex')).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const slugify = (value: string): string =>
  value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export type MarketRow = { code: string; countryCode: string; currency: string; locale: string };
export type CategoryRow = { code: string; name: string; sortOrder: number };
export type MerchantRow = { id: string; slug: string; marketCode: string; name: string };
export type ProductRow = {
  id: string;
  slug: string;
  merchantId: string;
  categoryCode: string;
  vatCategory: VatCategory;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
};

export const fixtureVatCategory: Readonly<Record<string, VatCategory>> = {
  pizza: 'food',
  bowl: 'food',
  burger: 'food',
  bread: 'groceries',
  apples: 'groceries',
  flowers: 'flowers',
  headphones: 'electronics',
  book: 'gifts'
};

function vatCategoryFor(productId: string): VatCategory {
  const category = fixtureVatCategory[productId];
  if (!category) throw new Error(`Fixture product ${productId} has no VAT category`);
  return category;
}

export type ProductOptionsRow = { productId: string; groups: readonly OptionGroup[] };

function optionRows(productRows: ProductRow[]): ProductOptionsRow[] {
  return syntheticProductOptions.map((def) => {
    const product = productRows.find((row) => row.slug === def.productId);
    if (!product) throw new Error(`Option fixture ${def.productId} has no fixture product`);
    const id = uuidV5(`product:${def.productId}`);
    const errors = validateOptionGroups({ ...def, productId: id, currency: product.currency });
    if (errors.length) throw new Error(`Option fixture ${def.productId} is invalid: ${errors.map((e) => e.code).join(', ')}`);
    return { productId: id, groups: def.groups };
  });
}

export const demoMarket: MarketRow = { code: 'demo-eu', countryCode: 'IE', currency: 'EUR', locale: 'en-IE' };

export function buildSeed() {
  const categoryRows: CategoryRow[] = categories.map((name, index) => ({ code: slugify(name), name, sortOrder: index }));
  const merchantRows = new Map<string, MerchantRow>();
  const productRows: ProductRow[] = products.map((product) => {
    const merchantSlug = slugify(product.merchant);
    const merchantId = uuidV5(`merchant:${product.merchant}`);
    if (!merchantRows.has(merchantSlug)) {
      merchantRows.set(merchantSlug, { id: merchantId, slug: merchantSlug, marketCode: demoMarket.code, name: product.merchant });
    }
    return {
      id: uuidV5(`product:${product.id}`),
      slug: product.id,
      merchantId,
      categoryCode: slugify(product.category),
      vatCategory: vatCategoryFor(product.id),
      name: product.name,
      description: product.description,
      priceMinor: product.priceCents,
      currency: demoMarket.currency
    };
  });
  return {
    markets: [demoMarket],
    categories: categoryRows,
    merchants: [...merchantRows.values()],
    products: productRows,
    productOptions: optionRows(productRows)
  };
}
