# Design: commerce-rules

## Shape
`priceBreakdown(market: MarketConfig, order: OrderInput): PriceBreakdown`. `getMarket(code)` resolves `SK`, `CZ`, `DE` or `AT` and throws `unknown_market` otherwise. Every amount is integer minor units of the market currency; arithmetic uses `BigInt` and overflows are rejected.

Order lines carry `id`, `quantity`, `unitPrice` (`Money`), `vatCategory` and an optional `vatRateId` override. The result lists `components` in display order. Components with `addsToPayable` sum to `payableMinor`; VAT contained in VAT-inclusive prices is shown with `addsToPayable: false`.

Rationale, rate table, sources and assumptions: [ADR-0018](../../../docs/adr/0018-commerce-rules.md).

## How apps/api will consume it (follow-up, API owner)
1. Add `"@tazumo/commerce": "workspace:*"` to `apps/api` dependencies.
2. New operation, for example `POST /v1/markets/{marketCode}/price-quotes`, request `{ lines: [{ productId, quantity }], deliveryDistanceMeters }`. The client never sends prices or VAT categories: the route loads `price_minor`, `currency` and the product's VAT category (and any rate override) from PostgreSQL for the given product IDs and market.
3. Call `priceBreakdown(getMarket(marketCode), order)`. Map `CommerceRuleError.code` to problem responses: `unknown_market` and unknown products → 404; `invalid_quantity`, `invalid_distance`, `duplicate_line`, `empty_order` → 400; `currency_mismatch`, `outside_delivery_area` → 422; `invalid_market_config` and `amount_overflow` → 500 (server data error).
4. Add a `PriceBreakdown` schema to `contracts/openapi.json` (amounts as `Money`, components with `kind`, `addsToPayable`, `synthetic`, `explanation`) and keep `dataStatus` so clients can show the synthetic and re-verify notice.
5. Products need a VAT category column; the catalogue category (`Food`, `Groceries`, `Shops`, `Gifts`) is not a tax classification.
6. Distance comes from a server-side geocoding or zone lookup later (PostGIS per ADR-0005); until then the endpoint is clearly marked synthetic.
