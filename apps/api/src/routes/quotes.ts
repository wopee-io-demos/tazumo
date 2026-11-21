import { createHash, randomUUID } from 'node:crypto';
import { CommerceRuleError, getMarket, priceBreakdown, type MarketConfig, type PriceBreakdown, type VatCategory } from '@tazumo/commerce';
import { lineKey, priceSelection, type PricedSelection, type Selection } from '@tazumo/product-options';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { routeSchema } from '../contract.ts';
import { apiError } from '../errors.ts';
import { loadOptionGroups } from '../product-options.ts';
import { rateLimitTier } from '../rate-limit.ts';

type QuoteBody = {
  marketCode: string;
  merchantId: string;
  items: Array<{ productId: string; quantity: number; selectedOptions?: Selection }>;
  deliveryAddress: { countryCode: string; postalCode: string };
  paymentMethod?: 'card' | 'cash';
};

const QUOTE_TTL_MS = 10 * 60_000;
const SYNTHETIC_MAX_METERS = 8_000;

const postalCodePatterns: Record<string, RegExp> = {
  SK: /^\d{3} ?\d{2}$/,
  CZ: /^\d{3} ?\d{2}$/,
  DE: /^\d{5}$/,
  AT: /^\d{4}$/
};

const clientErrors: Record<string, 400 | 422> = {
  invalid_quantity: 400,
  invalid_distance: 400,
  duplicate_line: 400,
  empty_order: 400,
  too_many_lines: 400,
  invalid_payment_method: 400,
  outside_delivery_area: 422
};

export function syntheticDistanceMeters(postalCode: string): number {
  const normalised = postalCode.replace(/\s+/g, '').toUpperCase();
  return createHash('sha256').update(normalised).digest().readUInt32BE(0) % (SYNTHETIC_MAX_METERS + 1);
}

type PricedLine = PricedSelection & { productId: string };

function toQuote(market: MarketConfig, breakdown: PriceBreakdown, distance: number, unavailable: string[], lines: PricedLine[]) {
  const money = (minorUnits: number) => ({ currency: breakdown.currency, minorUnits });
  return {
    id: randomUUID(),
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    subtotal: money(breakdown.subtotalMinor),
    deliveryFee: money(breakdown.deliveryFee.amountMinor),
    tax: money(breakdown.vat.reduce((sum, group) => sum + group.vatMinor, 0)),
    total: money(breakdown.totalMinor),
    itemsAvailable: unavailable.length === 0,
    unavailableProductIds: unavailable,
    payable: money(breakdown.payableMinor),
    rounding: money(breakdown.roundingMinor),
    smallOrderSurcharge: money(breakdown.smallOrderSurcharge.amountMinor),
    paymentMethod: breakdown.paymentMethod,
    pricesIncludeVat: breakdown.pricesIncludeVat,
    commerceMarket: market.code,
    vat: breakdown.vat.map((group) => ({
      rateId: group.rateId,
      basisPoints: group.basisPoints,
      label: group.label,
      net: money(group.netMinor),
      vat: money(group.vatMinor),
      gross: money(group.grossMinor),
      explanation: group.explanation
    })),
    components: breakdown.components.map((c) => ({
      kind: c.kind,
      amount: money(c.amountMinor),
      addsToPayable: c.addsToPayable,
      synthetic: c.synthetic,
      explanation: c.explanation
    })),
    deliveryDistance: {
      meters: distance,
      synthetic: true,
      explanation: 'Synthetic distance derived from the postal code until server-side geocoding or delivery zones exist.'
    },
    lines: lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      selectedOptions: line.selection,
      options: line.breakdown,
      basePrice: line.basePrice,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal
    })),
    dataStatus: { ...breakdown.dataStatus, distanceSynthetic: true, redeemable: false }
  };
}

export async function quoteRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.post<{ Body: QuoteBody }>(
    '/v1/order-quotes',
    { schema: routeSchema('post', '/v1/order-quotes'), config: { rateLimit: rateLimitTier.public } },
    async (request, reply) => {
      const body = {
        ...request.body,
        merchantId: request.body.merchantId.toLowerCase(),
        items: request.body.items.map((item) => ({ ...item, productId: item.productId.toLowerCase() }))
      };
      const marketRow = await pool.query<{ countryCode: string }>(`SELECT country_code AS "countryCode" FROM markets WHERE code = $1`, [
        body.marketCode
      ]);
      if (marketRow.rowCount === 0) return reply.code(404).send(apiError(request, 'market_not_found', 'Market not found'));
      const countryCode = marketRow.rows[0].countryCode;
      const merchant = await pool.query('SELECT 1 FROM merchants WHERE id = $1 AND market_code = $2', [body.merchantId, body.marketCode]);
      if (merchant.rowCount === 0) return reply.code(404).send(apiError(request, 'merchant_not_found', 'Merchant not found in this market'));

      let market: MarketConfig;
      try {
        market = getMarket(countryCode);
      } catch (error) {
        if (error instanceof CommerceRuleError && error.code === 'unknown_market') {
          return reply.code(422).send(apiError(request, 'unsupported_market', 'No pricing rules exist for this market yet'));
        }
        throw error;
      }
      if (body.deliveryAddress.countryCode.toUpperCase() !== countryCode) {
        return reply.code(422).send(apiError(request, 'outside_delivery_area', 'The delivery address is outside this market'));
      }
      const postalPattern = postalCodePatterns[countryCode];
      if (postalPattern && !postalPattern.test(body.deliveryAddress.postalCode.trim())) {
        return reply.code(400).send(apiError(request, 'invalid_postal_code', `Postal code does not match the ${countryCode} format`));
      }

      const productIds = [...new Set(body.items.map((item) => item.productId))];
      const products = await pool.query<{ id: string; priceMinor: number; currency: string; vatCategory: VatCategory; vatRateId: string | null; available: boolean }>(
        `SELECT id, price_minor AS "priceMinor", currency, vat_category AS "vatCategory", vat_rate_id AS "vatRateId", available
           FROM products WHERE merchant_id = $1 AND id = ANY($2::uuid[])`,
        [body.merchantId, productIds]
      );
      const byId = new Map(products.rows.map((row) => [row.id, row]));
      const missing = productIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        return reply.code(404).send(apiError(request, 'product_not_found', 'Unknown product for this merchant', { productIds: missing }));
      }

      const optionGroups = await loadOptionGroups(pool, productIds);
      const lines: PricedLine[] = [];
      for (const item of body.items) {
        const product = byId.get(item.productId)!;
        const definition = { productId: item.productId, currency: product.currency, groups: optionGroups.get(item.productId) ?? [] };
        const priced = priceSelection(definition, { currency: product.currency, minorUnits: product.priceMinor }, item.selectedOptions, item.quantity);
        if (priced.ok) {
          lines.push({ ...priced, productId: item.productId });
          continue;
        }
        if (priced.stage !== 'selection') {
          request.log.error({ optionsStage: priced.stage, codes: priced.errors.map((e) => e.code) }, 'product options failed on server data');
          return reply.code(500).send(apiError(request, 'internal_error', 'Internal server error'));
        }
        const errors = priced.errors.map(({ code, path }) => ({ code, path }));
        const sent = item.selectedOptions ?? {};
        const unavailableDefault = (groupId: unknown) =>
          typeof groupId === 'string' &&
          !Object.hasOwn(sent, groupId) &&
          definition.groups.some((g) => g.id === groupId && g.options.some((o) => o.isDefault === true && !o.available));
        const availabilityOnly = errors.every(
          (e) => e.code === 'option_unavailable' || ((e.code === 'missing_required_group' || e.code === 'too_few_options') && unavailableDefault(e.path[1]))
        );
        if (availabilityOnly) {
          return reply.code(409).send(apiError(request, 'option_unavailable', 'A selected option is not available', { productId: item.productId, errors }));
        }
        return reply.code(400).send(apiError(request, 'invalid_options', 'The selected options are not valid for this product', { productId: item.productId, errors }));
      }

      const distance = syntheticDistanceMeters(body.deliveryAddress.postalCode);
      let breakdown: PriceBreakdown;
      try {
        breakdown = priceBreakdown(market, {
          lines: lines.map((line) => {
            const product = byId.get(line.productId)!;
            return {
              id: lineKey(line.productId, line.selection),
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              vatCategory: product.vatCategory,
              ...(product.vatRateId ? { vatRateId: product.vatRateId } : {})
            };
          }),
          deliveryDistanceMeters: distance,
          paymentMethod: body.paymentMethod ?? 'card'
        });
      } catch (error) {
        if (!(error instanceof CommerceRuleError)) throw error;
        const status = clientErrors[error.code];
        if (error.code === 'outside_delivery_area') {
          return reply.code(422).send(
            apiError(request, error.code, `The synthetic delivery distance of ${distance} m is beyond the last delivery band`, {
              distanceMeters: distance,
              maxMeters: error.details.maxMeters,
              distanceSynthetic: true
            })
          );
        }
        if (error.code === 'duplicate_line') {
          const line = lines.find((l) => lineKey(l.productId, l.selection) === error.details.lineId);
          return reply.code(400).send(
            apiError(request, error.code, 'The same product with the same options appears on more than one line', {
              productId: line?.productId,
              selectedOptions: line?.selection
            })
          );
        }
        if (status) return reply.code(status).send(apiError(request, error.code, error.message));
        request.log.error({ commerceError: error.code }, 'pricing failed on server data');
        return reply.code(500).send(apiError(request, 'internal_error', 'Internal server error'));
      }
      const unavailable = productIds.filter((id) => !byId.get(id)!.available);
      return toQuote(market, breakdown, distance, unavailable, lines);
    }
  );
}
