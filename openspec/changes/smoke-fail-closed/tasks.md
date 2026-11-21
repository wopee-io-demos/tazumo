# Tasks

- [x] Robust main guard (`fileURLToPath(import.meta.url) === realpathSync(argv[1])`).
- [x] Shared `verdict()` with the CLI demoting short "passed" runs; `verify-report.mjs` wired into `android-smoke.sh` after both cases.
- [x] Tests: the CLI run from a path with a space and via a symlink, CLI usage, and verifier cases for a missing, zero-step, partial or mismatched report and negative semantics. Review fixes: realpath on both sides of the guard (also under `--preserve-symlinks-main`); stale reports removed before each run; a case without an id and out-of-order steps rejected; an end-to-end negative CLI run. `pnpm --filter @tazumo/mobile test` passes 17/17. With the old guard restored, the path-with-space/symlink and usage tests fail (failing-before-fix check).
- [ ] CI `Android emulator smoke` green on the PR head; merge SHA recorded on #132.
