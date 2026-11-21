# Tasks

- [x] Core helpers with unit tests (4 tests: slug round trip, toggle, corrupted input, unknown ids). `pnpm test` passes locally.
- [x] Web hook, heart button on card and detail, Favourites filter with empty state and reset. Existing keyboard test updated for the new tab stop.
- [x] `tests/e2e/favourites.spec.ts`: 6 tests (toggle and labels in EN/CS/DE, filter and reload, empty state and reset, cross-tab sync, corrupted storage and unknown ids, blocked storage). Local Playwright passes all specs.
- [ ] Current-head CI green and review findings resolved (recorded in the PR before merge).
- [ ] New ids registered in the SUT contract (filed on #32).
