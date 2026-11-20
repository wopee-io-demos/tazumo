import type pg from 'pg';
import { buildSeed } from './fixtures.ts';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';

export async function seed(pool: pg.Pool) {
  const data = buildSeed();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of data.markets) {
      await client.query(
        `INSERT INTO markets (code, country_code, currency, locale) VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET country_code = EXCLUDED.country_code, currency = EXCLUDED.currency, locale = EXCLUDED.locale`,
        [m.code, m.countryCode, m.currency, m.locale]
      );
    }
    for (const c of data.categories) {
      await client.query(
        `INSERT INTO catalogue_categories (code, name, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
        [c.code, c.name, c.sortOrder]
      );
    }
    for (const m of data.merchants) {
      await client.query(
        `INSERT INTO merchants (id, slug, market_code, name, accepting_orders, delivery_eta_minutes, synthetic)
         VALUES ($1, $2, $3, $4, false, NULL, true)
         ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, market_code = EXCLUDED.market_code, name = EXCLUDED.name,
           accepting_orders = false, delivery_eta_minutes = NULL, synthetic = true, updated_at = now()`,
        [m.id, m.slug, m.marketCode, m.name]
      );
    }
    for (const p of data.products) {
      await client.query(
        `INSERT INTO products (id, slug, merchant_id, category_code, name, description, price_minor, currency, available, synthetic)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true)
         ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, merchant_id = EXCLUDED.merchant_id, category_code = EXCLUDED.category_code,
           name = EXCLUDED.name, description = EXCLUDED.description, price_minor = EXCLUDED.price_minor, currency = EXCLUDED.currency,
           available = true, synthetic = true, updated_at = now()`,
        [p.id, p.slug, p.merchantId, p.categoryCode, p.name, p.description, p.priceMinor, p.currency]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { markets: data.markets.length, categories: data.categories.length, merchants: data.merchants.length, products: data.products.length };
}

if (import.meta.main) {
  const pool = createPool({ databaseUrl: loadConfig().databaseUrl });
  try {
    console.log('Seeded synthetic fixtures:', await seed(pool));
  } finally {
    await pool.end();
  }
}
