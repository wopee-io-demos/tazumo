# Order quotes on @tazumo/commerce

## Why
Issue #103. `POST /v1/order-quotes` has been in the contract since 0.1.0 but was never implemented. `@tazumo/commerce` (#80, ADR-0018) now provides the authoritative price breakdown.

## What changes
- `POST /v1/order-quotes` loads prices, currency and the product VAT category from PostgreSQL and calls `priceBreakdown`. Client-supplied prices are never used.
- Migration `0005`: `products.vat_category` (`food`, `groceries`, `flowers`, `gifts`, `electronics`) and an optional `vat_rate_id`. The catalogue category is not a tax class. The seed sets an explicit VAT category for each fixture product.
- The commerce market is resolved from the market row's `countryCode`. The seeded `demo-eu` (IE) market has no rules and returns 422 `unsupported_market`.
- Contract `0.7.0-draft`, additive:
  - `total` stays the exact total; `payable` and `rounding` are separate fields, and rounding applies only to cash payments;
  - new `paymentMethod`, `pricesIncludeVat`, `vat[]`, `components[]`, `deliveryDistance` and `dataStatus`;
  - new `SignedMoney` schema for the rounding adjustment;
  - `QuoteRequest.items` gets `maxItems: 100`, and the operation gets a 404 response.
- Request bodies are now validated against the contract.

## Out of scope
Persisting quotes and creating orders (`redeemable: false`), real geocoding or zones, real fees, payments, UI.

## Tracking
Issue #103, ADR-0018, OpenSpec `commerce-rules`.
