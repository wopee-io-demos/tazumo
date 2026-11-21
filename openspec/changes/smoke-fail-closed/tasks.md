# Tasks

- [x] Robust main guard (`fileURLToPath(import.meta.url) === realpathSync(argv[1])`).
- [x] Shared `verdict()` with the CLI demoting short "passed" runs; `verify-report.mjs` wired into `android-smoke.sh` after both cases.
- [x] Tests: the CLI run from a path with a space and via a symlink, CLI usage, and verifier cases for a missing, zero-step, partial or mismatched report and negative semantics. `pnpm --filter @tazumo/mobile test` passes 15/15. With the old guard restored, the path-with-space/symlink and usage tests fail (failing-before-fix check).
- [ ] CI `Android emulator smoke` green on the PR head; merge SHA recorded on #132.
