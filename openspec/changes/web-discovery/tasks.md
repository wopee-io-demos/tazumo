# Tasks

- [x] Core: merchant fixtures, merchant search, lookups, `setQuantity`, `removeFromCart`, `cartLines` and EN/CS/DE keys. `pnpm test`: 10/10 pass locally (6 new tests in `discovery.test.ts`).
- [x] Web: merchant list, hash routes, merchant/product detail, cart drawer with remove and line totals, empty and not-found states. `pnpm typecheck` and `pnpm build` pass locally.
- [x] Playwright `tests/e2e/web-discovery.spec.ts`: 8 tests (positive flows, no results, unknown ids, removing the last item, CS/DE currency, keyboard/landmarks, 375 px viewport). Local Chromium run, all 13 E2E tests pass, including the existing `marketplace.spec.ts`.
- [x] OpenSpec validate (strict): `change/web-discovery` passes. Failures in agent-board-audit, european-localization and marketplace-api-contract were already present on main.
- [ ] Current-head CI green on the PR.
- [ ] Independent review findings resolved and recorded in the PR.
- [ ] Merged and merge SHA recorded on #3.
