# Tasks

- [x] Core: merchant fixtures, merchant search, lookups, `setQuantity`, `removeFromCart`, `cartLines` and EN/CS/DE keys. `pnpm test`: 10/10 locally and in CI.
- [x] Web: merchant list, hash routes, merchant/product detail, cart drawer with remove and line totals, empty and not-found states.
- [x] Playwright `tests/e2e/web-discovery.spec.ts`: 8 tests. CI on PR #50 head 4630237: [Quality checks](https://github.com/wopee-io-demos/tazumo/actions/runs/44812293794), 13/13 E2E.
- [x] OpenSpec validate (strict): `change/web-discovery` valid.
- [x] Independent review (delegated reviewer, SHA 5b79eac): 0 blockers, 2 major and 9 minor/nit findings, resolved in 4f2b959 ([PR #50 comment](https://github.com/wopee-io-demos/tazumo/pull/50#issuecomment-7049436401)).
- [x] PR #50 head 4630237 green: check, api, dependency-audit, Android debug APK, iOS simulator build. Merged as b39be01.
- [x] Main CI on b39be01 failed: #51's `a11y.spec.ts` and `regression.spec.ts`, merged in parallel, treat every h3 in `main` as a product and expect one status region ([Quality checks](https://github.com/wopee-io-demos/tazumo/actions/runs/44820242928)). Fixed forward in PR #73 (merchant names are no longer headings; one live region), merged as e8d4776.
- [x] Main CI on e8d4776: [Quality checks](https://github.com/wopee-io-demos/tazumo/actions/runs/44821188031), [Test evidence](https://github.com/wopee-io-demos/tazumo/actions/runs/44821187940) and Dependency security review all pass. Native builds were still queued when this was written: [run 44821188084](https://github.com/wopee-io-demos/tazumo/actions/runs/44821188084).
- [ ] Register discovery selectors in `contracts/sut.json` (#63, after #33).
