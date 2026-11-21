# Tasks

- [x] Package `@tazumo/product-options` with types, `validateOptionGroups`, `validateSelection`, `priceSelection`, `lineKey` and synthetic fixtures for `pizza`, `burger` and `bowl`.
- [x] Unit tests: 48 tests. The package test script (`pnpm --filter @tazumo/product-options test`) enforces 100 % line, branch and function coverage and is wired into the root `pnpm test`. Local run on Node 22.19.0: 48/48 pass, coverage 100/100/100.
- [x] Independent review of e6ea868 (fresh reviewer agent): no blockers. Should-fixes 1 to 4 and nits 6 and 8 to 13 were fixed. Nit 5 (branded `lineKey` input) and nit 7 (collecting selection and pricing errors together) are covered by documentation in design.md instead.
- [ ] Current-head CI green on the PR.
- [x] Contract test against `@tazumo/commerce` (#80, merged in f9616f7): `commerce-contract.test.ts` asserts `Money` assignability both ways, equal `MAX_LINE_QUANTITY`, and that the commerce `priceBreakdown` line matches `unitPrice` and `lineTotal` for every fixture at quantities 1, 3 and 999. 3/3 pass locally.

## Slice 2: contract, storage and quote

- [x] Migration `0006_product-options.sql` with `product_option_groups` and `product_options`, availability as merchant-ops `Availability` JSON, read-only grants for `tazumo_api`; the migrations test covers up, re-run, down and up again.
- [x] Seed validates the `pizza`, `burger` and `bowl` fixtures with `validateOptionGroups` and stores them; re-seeding is idempotent.
- [x] `GET /v1/merchants/{merchantId}/products` returns `optionGroups` with availability resolved per request.
- [x] `POST /v1/order-quotes` prices `selectedOptions` through `priceSelection`, keys commerce lines by `lineKey` and returns `Quote.lines`; OpenAPI `0.8.0-draft`.
- [x] ADR-0022 (option storage and the line snapshot).
- [x] `apps/api/test/product-options.test.ts`: 26 tests against PostgreSQL 16 (catalogue, invalid definition served unavailable, defaults, package parity, two configurations, every selection error code, 409 availability including an out-of-stock required default, duplicate configuration, schema rejections, ignored client price, 500 on a broken definition, runtime-role grants, database constraints). Local run: `apps/api` 149/149, root `pnpm test` pass, `pnpm typecheck` and `pnpm build` pass.
- [x] Required CI on PR #174 at 86a8b13: check, evidence, dependency-audit, CodeQL PR analysis, Secret scan, api (PostgreSQL integration), backoffice and payments all pass (runs 44931838583, 44931838586, 44931838594, 44931838633, 44931838558, 44931838565, 44931838674, 44931838548). Independent review of 9e8ac18 and of the 9e8ac18..86a8b13 delta: no blockers, findings resolved or deferred as nits in the PR.

## Slice 3a: web picker and cart lines

- [x] `@tazumo/product-options`: `cartKey`, `parseCartKey`, `lineTestKey`, `priceCartLines` and `syntheticOptionLabel` (en, cs, de). Package tests 56/56, coverage 100/100/100, including uniqueness of the line test keys across every valid fixture configuration.
- [x] Web product page option picker (fieldsets, radios and checkboxes, deltas in labels, disabled unavailable options, live unit price, validation message with Add disabled) and per-configuration cart lines.
- [x] SUT contract 0.6.0 (additive): `optionsError`, `optionGroup`, `option`, `optionNone`, `cartLineOptions`, placeholders `{groupId}`, `{optionId}`, `{lineId}`, journey `product-options`; `pnpm check:sut --base origin/main` reports a minor change.
- [x] Playwright, local Chromium on a private port: `product-options.spec.ts` 4/4 (journey, validation and unavailable option, Czech negative delta and optional none, axe scan), plus `sut-contract`, `web-discovery`, `a11y`, `regression`, `marketplace`, `web-i18n` and `favourites` specs passing.
- [ ] Current-head CI green on the slice 3a PR.
