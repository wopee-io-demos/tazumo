import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { rateLimitTier } from '../rate-limit.ts';
import { apiError } from '../errors.ts';
import { routeSchema, toFastifyPath } from '../contract.ts';
import { loadOptionGroups } from '../product-options.ts';
import { validateOptionGroups } from '@tazumo/product-options';

const marketCode = { pattern: '^[a-z0-9-]{1,64}$' };

export async function catalogueRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.get('/v1/markets', { schema: routeSchema('get', '/v1/markets'), config: { rateLimit: rateLimitTier.public } }, async () => {
    const { rows } = await pool.query(
      `SELECT code, country_code AS "countryCode", currency, locale FROM markets ORDER BY code`
    );
    return rows;
  });

  app.get<{ Querystring: { marketCode: string } }>(
    '/v1/merchants',
    { schema: routeSchema('get', '/v1/merchants', { marketCode }), config: { rateLimit: rateLimitTier.public } },
    async (request, reply) => {
      const market = await pool.query('SELECT 1 FROM markets WHERE code = $1', [request.query.marketCode]);
      if (market.rowCount === 0) return reply.code(400).send(apiError(request, 'unknown_market', 'Market is not supported'));
      const { rows } = await pool.query(
        `SELECT m.id, m.slug, m.market_code AS "marketCode", m.name, m.accepting_orders AS "acceptingOrders",
                m.delivery_eta_minutes AS "deliveryEtaMinutes", m.synthetic,
                COALESCE(array_agg(DISTINCT p.category_code ORDER BY p.category_code)
                         FILTER (WHERE p.category_code IS NOT NULL), '{}') AS categories
           FROM merchants m
           LEFT JOIN products p ON p.merchant_id = m.id
          WHERE m.market_code = $1
          GROUP BY m.id
          ORDER BY m.name, m.id`,
        [request.query.marketCode]
      );
      return rows;
    }
  );

  const productsPath = '/v1/merchants/{merchantId}/products';
  app.get<{ Params: { merchantId: string } }>(
    toFastifyPath(productsPath),
    { schema: routeSchema('get', productsPath), config: { rateLimit: rateLimitTier.public } },
    async (request, reply) => {
      const merchant = await pool.query('SELECT 1 FROM merchants WHERE id = $1', [request.params.merchantId]);
      if (merchant.rowCount === 0) return reply.code(404).send(apiError(request, 'merchant_not_found', 'Merchant not found'));
      const { rows } = await pool.query(
        `SELECT id, slug, merchant_id AS "merchantId", category_code AS category, name, description,
                json_build_object('currency', currency, 'minorUnits', price_minor) AS price, available, synthetic
           FROM products
          WHERE merchant_id = $1
          ORDER BY name, id`,
        [request.params.merchantId]
      );
      const optionGroups = await loadOptionGroups(pool, rows.map((row) => row.id));
      return rows.map((row) => {
        const groups = optionGroups.get(row.id);
        if (!groups) return row;
        const errors = validateOptionGroups({ productId: row.id, currency: row.price.currency, groups });
        if (errors.length === 0) return { ...row, optionGroups: groups };
        request.log.error({ productId: row.id, codes: errors.map((e) => e.code) }, 'invalid product option definition');
        return { ...row, available: false };
      });
    }
  );
}
