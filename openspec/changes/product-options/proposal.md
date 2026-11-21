# Change: Product option groups and customisation pricing (slice 1)

Issue: [#82](https://github.com/wopee-io-demos/tazumo/issues/82). Slice 1 only: the pure package `@tazumo/product-options`.

## Why
Products cannot declare sizes, extras or sauces. Web, native and the API need one module that validates a selection and prices it in integer minor units, so every surface computes the same unit price and the server stays authoritative.

## What changes
- New package `packages/product-options` (`@tazumo/product-options`): option group types, `validateOptionGroups`, `validateSelection`, `priceSelection`, `lineKey` and synthetic option fixtures for the existing `pizza`, `burger` and `bowl` products.
- The package test script enforces 100 % line, branch and function coverage and runs from the root `pnpm test`.

## Out of scope
Contract and API changes (`optionGroups` on `Product`, `selectedOptions` on `OrderItem`, storage, quote integration) and the web and native pickers, which are slices 2 and 3 of #82. Option images, nested options, per-market option prices, merchant editing and stock per option.
