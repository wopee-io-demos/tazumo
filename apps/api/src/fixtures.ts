import { createHash } from 'node:crypto';
import { categories, products } from '@tazumo/core';

export const fixtureNamespace = 'b9f0c6a4-5d2e-4f1a-9c3b-7e8d2a6f4c10';

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
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
};

export const demoMarket: MarketRow = { code: 'demo', countryCode: 'IE', currency: 'EUR', locale: 'en-IE' };

export function buildSeed() {
  const categoryRows: CategoryRow[] = categories.map((name, index) => ({ code: slugify(name), name, sortOrder: index }));
  const merchantRows = new Map<string, MerchantRow>();
  const productRows: ProductRow[] = products.map((product) => {
    const merchantSlug = slugify(product.merchant);
    const merchantId = uuidV5(`merchant:${merchantSlug}`);
    if (!merchantRows.has(merchantSlug)) {
      merchantRows.set(merchantSlug, { id: merchantId, slug: merchantSlug, marketCode: demoMarket.code, name: product.merchant });
    }
    return {
      id: uuidV5(`product:${product.id}`),
      slug: product.id,
      merchantId,
      categoryCode: slugify(product.category),
      name: product.name,
      description: product.description,
      priceMinor: product.priceCents,
      currency: demoMarket.currency
    };
  });
  return { markets: [demoMarket], categories: categoryRows, merchants: [...merchantRows.values()], products: productRows };
}
