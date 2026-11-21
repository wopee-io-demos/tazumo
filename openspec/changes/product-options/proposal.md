# Change: Product option groups and customisation pricing (slices 1, 2 and 3a)

Issue: [#82](https://github.com/wopee-io-demos/tazumo/issues/82). Slice 1: the pure package `@tazumo/product-options`. Slice 2: contract, storage, catalogue and quote. Slice 3a: the web option picker and the option-aware cart.

## Why
Products cannot declare sizes, extras or sauces. Web, native and the API need one module that validates a selection and prices it in integer minor units, so every surface computes the same unit price and the server stays authoritative.

## What changes
- New package `packages/product-options` (`@tazumo/product-options`): option group types, `validateOptionGroups`, `validateSelection`, `priceSelection`, `lineKey` and synthetic option fixtures for the existing `pizza`, `burger` and `bowl` products.
- The package test script enforces 100 % line, branch and function coverage and runs from the root `pnpm test`.
- Slice 2: migration `0006_product-options.sql` (`product_option_groups`, `product_options`), synthetic option fixtures seeded for `pizza`, `burger` and `bowl`, `optionGroups` on the catalogue products route, `selectedOptions` priced in `POST /v1/order-quotes` with a per-line snapshot in `Quote.lines`, OpenAPI `0.8.0-draft` (additive) and ADR-0022.

- Slice 3a: cart-line helpers (`cartKey`, `parseCartKey`, `lineTestKey`, `priceCartLines`) and synthetic en/cs/de option labels in `@tazumo/product-options`; the web product page option picker and per-configuration cart lines; SUT contract 0.6.0 (additive).

## Out of scope
The native picker (slice 3b of #82). Persisting the line snapshot waits for quote persistence (#83), which stores it as ADR-0022 describes. Option images, nested options, per-market option prices, merchant editing and stock per option.
