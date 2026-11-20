# Tasks

## Web gallery (PR 1)
- [x] Capture spec `tests/screenshots/capture.spec.ts` with fixed locale, timezone, scheme, clock, reduced motion; asserts catalogue heading, product counts and cart subtotal €46.20 before each capture. Evidence: 8/8 captures passed locally (Playwright 1.65.1, Chromium 159.0.8154.6, macOS arm64).
- [x] `scripts/capture-web-screenshots.sh` builds, serves `vite preview`, captures, quantises with pngquant 3.0.3 and writes `provenance.json`. Evidence: two consecutive runs on SUT `b1cd347` produced byte-identical PNGs (md5 compared); largest file 121,680 bytes.
- [x] Every committed web PNG opened and checked: real app, no error page, blank screen or spinner.
- [x] README gallery with provenance table and the "reference imagery, not test verdicts" statement.
- [x] Local checks: `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` passed; `openspec validate --all --strict` passes for `readme-screenshots` (pre-existing failures in other changes are unrelated).
- [ ] Current-head CI green, independent review recorded, merged; merge SHA on #37.

## Native gallery (PR 2)
- [ ] `.github/workflows/screenshots.yml`: iOS simulator capture on hosted macos-15 and Android emulator capture on ubuntu-latest with KVM; PNGs uploaded as artifacts.
- [ ] Copy the CI-produced PNGs into `docs/screenshots/ios/` and `docs/screenshots/android/` with the run URL as provenance.

## Downstream
- [ ] One `status:backlog` issue per downstream repo asking for a link to the canonical captures.
