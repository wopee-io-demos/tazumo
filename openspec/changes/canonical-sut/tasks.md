# Canonical SUT integration tasks

Issues #32, #53, #63. PR #33 (v0.1.0, superseded) and its successor PR on `feat/sut-contract-v2` (v0.2.0).

- [x] Define SUT contract fixture IDs, web/native selectors, journeys and capability boundaries (v0.1.0, PR #33).
- [x] Add stable selectors to web and Expo native clients; a real disabled native checkout control `sut-checkout-disabled`.
- [x] Specify iOS (`accessibility id`) vs Android (`id`) Appium locator strategies for React Native testIDs.
- [x] Register #50 web discovery IDs, `selectorTemplates` and hash `routes` (#63) and #45 native detail/cart screen IDs (#53) as v0.2.0. Evidence: `pnpm check:sut --base origin/feat/canonical-sut-contract` reports a minor change from v0.1.0 (no ID removed or changed).
- [x] `pnpm check:sut` scans all `.ts`/`.tsx` sources of `apps/web/src` (7 files) and `apps/mobile/src` (7 files): 56 web and 38 native selectors found.
- [x] Negative tests: `pnpm test:contract` removes every registered ID's source constructs in turn and asserts the check fails; semver tests for rename, value change, addition, prose edit and gratuitous major bump (23/23 pass locally, Node 22.19).
- [x] Browser evidence: `pnpm test:e2e` 33/33 pass locally in Chromium, including `tests/e2e/sut-contract.spec.ts` (merchant-detail-cart journey and not-found routes on contract selectors only).
- [x] CI compares the contract with the pull request's base branch and fails on a missing semantic version bump.
- [ ] Current-head CI green on the v0.2.0 PR.
- [ ] Verify native IDs and the disabled state (`GET /element/{id}/enabled`) in a real Appium tree on iOS and Android. Not done here; native IDs are verified statically only.
- [ ] Downstream repositories pin v0.2.0 and the merge SHA.
