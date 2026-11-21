# Proposal: Android smoke executor fails closed

Tracking issue: [#132](https://github.com/wopee-io-demos/tazumo/issues/132). It follows up [#59](https://github.com/wopee-io-demos/tazumo/issues/59) and #79.

## Why
`apps/mobile/tests/run-case.mjs` ran its CLI only when ``import.meta.url === `file://${process.argv[1]}` ``. From a checkout path containing a space, or reached through a symlink, that comparison is false. The executor then exited 0 without running a step or writing a report, which is a false green in the native CI gate.

## What changes
- The main guard compares `fileURLToPath(import.meta.url)` with `realpathSync(process.argv[1])`.
- A shared `verdict()` accepts a positive run only when every case step completed, with zero steps never accepted. A negative run is accepted only when it failed on its last step. The CLI demotes a "passed" report that fails this check to `infrastructure-failed`.
- New `verify-report.mjs`, called by `android-smoke.sh` after each case, independently fails on:
  - a missing or unreadable `report.json`;
  - a case id mismatch;
  - a zero-step or partial run.
- `android-smoke.sh` resolves its own directory with `pwd -P`.

## Scope
No change to the case format, the smoke steps or `native-builds.yml`.
