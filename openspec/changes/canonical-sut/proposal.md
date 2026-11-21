# Change: Canonical cross-platform SUT contract

Issues: [#32](https://github.com/wopee-io-demos/tazumo/issues/32), [#53](https://github.com/wopee-io-demos/tazumo/issues/53), [#63](https://github.com/wopee-io-demos/tazumo/issues/63). ADRs: [0007](../../../docs/adr/0007-canonical-sut.md), [0008](../../../docs/adr/0008-self-hosted-ci-runners.md). Supersedes PR #33.

## Why
The Wopee demo repositories (web-demo, web-demo-pw-cli, mobile-demo) need one stable, versioned test surface on web and native that does not depend on CSS, rendered order or localized labels.

## What changes
- `contracts/sut.json` v0.2.0: fixtures, web and native `selectors`, `selectorTemplates` with fixture placeholders, web hash `routes`, journeys with `platforms`, capability boundaries (checkout and tracking not real).
- Stable `sut-*` IDs on the web (#33 IDs plus #50 discovery IDs) and native (#33 IDs plus #45 detail/cart screen IDs).
- `scripts/check-sut-contract.mjs` (`pnpm check:sut`) scans every source file of both apps and enforces semantic versioning against the base branch in CI.
- Contract unit tests (`tests/contract/sut-contract.test.mts`) and a Chromium journey on contract selectors only (`tests/e2e/sut-contract.spec.ts`).

## Out of scope
Appium runs against native IDs, a deployed web instance, a fixture reset endpoint, and edits to downstream repositories.
