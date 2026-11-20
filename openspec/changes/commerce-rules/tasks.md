# Tasks

- [x] ADR-0018: pure package versus API module, core extension, database tables, external tax engine, per-line rounding and banker's rounding; VAT sources with retrieval date 2026-11-20 and classification assumptions.
- [x] Market configuration for SK, CZ, DE and AT with cited rates flagged `reverify`. Evidence: `packages/commerce/src/markets.test.ts` (consistency, currency/locale/display table, category default table, every rate cites an EU and a national official source).
- [x] `priceBreakdown` with lines, subtotal, synthetic delivery band fee, synthetic small-order surcharge, VAT per rate, total, CZK rounding and explanations. Evidence: `packages/commerce/src/breakdown.test.ts` (SK three-rate basket, AT 13 % and 4.9 % override, CZK half-haler VAT and whole-crown payable up and down, EUR never rounded, VAT-exclusive configuration, per-rate rounding, band and surcharge boundaries, payable equals the sum of `addsToPayable` components in every market).
- [x] Typed rejection of zero, negative, fractional and oversized quantities, invalid prices, currency mismatch, unknown categories, rates and markets, malformed orders, out-of-area distances, overflow and inconsistent configurations. Evidence: same suite.
- [x] Local checks on the branch: `pnpm typecheck` (all five workspace packages), `pnpm test` (core 4/4, commerce 23/23, contract 15/15), `pnpm build` and `openspec validate --all --strict` (`commerce-rules` valid; `agent-board-audit`, `european-localization` and `marketplace-api-contract` already fail on main).
- [ ] Current-head CI green on the PR.
- [ ] Independent review recorded with the reviewed SHA.
- [ ] Merged; merge SHA recorded on #11.
- [ ] Follow-up for the API owner: price-quote endpoint consuming `@tazumo/commerce` (see design.md).
