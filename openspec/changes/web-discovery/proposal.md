# Change: Web merchant discovery and detail routes

Issue: [#3](https://github.com/wopee-io-demos/tazumo/issues/3) (slice of the consumer web MVP epic). ADR: [0012](../../../docs/adr/0012-hash-client-routes.md).

## Why
The web prototype lists products only. Shoppers cannot browse restaurants and shops as places, open a merchant or product page, or remove an item from the cart in one step.

## What changes
- `@tazumo/core` (additive): synthetic merchant fixtures derived from the existing product data, merchant search across merchant and product fields, lookups, `setQuantity`, `removeFromCart` and `cartLines` with integer minor-unit line totals, plus EN/CS/DE message keys.
- `apps/web`: a merchant list on home that follows the category filter and search; hash routes `#/merchant/<id>` and `#/product/<id>`; a cart drawer with increase, decrease, remove, line totals and subtotal; empty and not-found states; focus management and landmarks. New styles reference brand token variables only.
- Playwright spec `tests/e2e/web-discovery.spec.ts`.

## Out of scope
Real merchants, inventory, opening hours, delivery estimates, checkout and payments (checkout stays disabled), translated merchant inventory, cart persistence and SEO rendering (ADR-0004).
