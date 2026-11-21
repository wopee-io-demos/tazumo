# Tasks

- [x] Package `@tazumo/product-options` with types, `validateOptionGroups`, `validateSelection`, `priceSelection`, `lineKey` and synthetic fixtures for `pizza`, `burger` and `bowl`.
- [x] Unit tests: 48 tests. The package test script (`pnpm --filter @tazumo/product-options test`) enforces 100 % line, branch and function coverage and is wired into the root `pnpm test`. Local run on Node 22.19.0: 48/48 pass, coverage 100/100/100.
- [x] Independent review of e6ea868 (fresh reviewer agent): no blockers. Should-fixes 1 to 4 and nits 6 and 8 to 13 were fixed. Nit 5 (branded `lineKey` input) and nit 7 (collecting selection and pricing errors together) are covered by documentation in design.md instead.
- [ ] Current-head CI green on the PR.
- [x] Contract test against `@tazumo/commerce` (#80, merged in f9616f7): `commerce-contract.test.ts` asserts `Money` assignability both ways, equal `MAX_LINE_QUANTITY`, and that the commerce `priceBreakdown` line matches `unitPrice` and `lineTotal` for every fixture at quantities 1, 3 and 999. 3/3 pass locally.
