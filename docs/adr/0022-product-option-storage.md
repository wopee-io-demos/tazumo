# ADR-0022: Product option storage and the order line snapshot

Status: Proposed
Date: 2026-11-21
Tracking: issue #82 (slice 2), OpenSpec `product-options`, builds on ADR-0009, ADR-0018 and ADR-0019

## Context

`@tazumo/product-options` validates and prices option groups (slice 1). The API now has to store the definitions, serve them in the catalogue and price them in the quote. Two questions need a durable answer: how definitions are stored, and what an order line keeps when the definition changes after the customer ordered. Option availability has to follow the merchant-operations model (ADR-0019) rather than a fixed flag.

## Options

1. **A `jsonb` column on `products`** holding the whole definition. One read and no joins, but the database cannot enforce unique option IDs, group membership or bounds, and merchant editing (#92) would rewrite the whole document for every change.
2. **Two relational tables**, `product_option_groups` and `product_options`, keyed by `(product_id, id)`. The database enforces the cheap rules; the package enforces the rest on every read that prices.
3. **Shared option groups across products** (a group table referenced by many products). Closer to the prototype's global list, but per-product bounds and defaults then need an override table, and issue #82 asks for per-product applicability.

## Decision

1. Option 2. Groups and options belong to one product and are deleted with it. Option IDs are unique per product, and the option's foreign key `(product_id, group_id)` keeps an option inside a group of the same product. `CHECK` constraints mirror the package rules for ID pattern, bounds, `required = (min >= 1)` and `single` meaning `max = 1`. `validateOptionGroups` stays authoritative: the seed refuses an invalid fixture, and a stored definition that fails it makes the quote return 500.
2. **Availability is the `@tazumo/merchant-ops` `Availability` value** (`in_stock`, `out_of_stock` or a `scheduled` window) in a `jsonb` column, resolved with `isAvailableAt` when a response is built. An invalid value resolves to unavailable.
3. **The order line keeps a snapshot, not a reference.** For each line: the product ID, quantity, resolved selection (every group listed), and for each chosen option its group ID, option ID, label key and price delta, plus the base price, unit price and line total. Quote persistence (#83) stores this as one `jsonb` value on the quote line and copies it to the order line, so later edits to options never change a placed order. Until then the snapshot is returned in `Quote.lines` and nothing is stored.
4. The runtime role `tazumo_api` only reads the option tables. Writes come from the seed and, later, the merchant console (#92) with its own grants.

## Consequences

- Catalogue reads add one query per page of products; the quote adds one query per request.
- Merchant editing (#92) can change one option at a time, and the database rejects inconsistent rows early.
- A snapshot can hold a label key that a later client version no longer translates. Clients show the key's fallback text, and order history never re-prices.
- A definition that fails `validateOptionGroups` is logged and its product is served with `available: false` and no `optionGroups`, so the catalogue never offers what the quote would refuse.
- `Product.available` does not yet account for a required group with no available option; the quote answers 409 for it. When #75 moves product availability to the same `Availability` model, product and option availability share one resolution path.
