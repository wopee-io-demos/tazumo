# Tasks

## Web gallery (PR 1)
- [x] Capture spec `tests/screenshots/capture.spec.ts` with fixed locale, timezone, scheme, clock, reduced motion; asserts catalogue heading, product counts, cart subtotal €46.20, loaded web fonts and no page/console errors before each capture. Font check verified to fail when Google Fonts are blocked (no loaded faces). Evidence: 8/8 captures passed locally (Playwright 1.65.1, Chromium 159.0.8154.6, macOS arm64).
- [x] `scripts/capture-web-screenshots.sh` builds, serves `vite preview`, captures into a temp dir, quantises with pngquant 3.0.3 (required), enforces 300 KB per PNG, writes `provenance.json` and only then replaces `docs/screenshots/web/`. Evidence: two consecutive runs on SUT `b1cd347` produced byte-identical PNGs (md5 compared); largest file 121,680 bytes.
- [x] Every committed web PNG opened and checked: real app, no error page, blank screen or spinner.
- [x] README gallery with provenance table and the "reference imagery, not test verdicts" statement.
- [x] Local checks: `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` passed; `npx --yes --package @fission-ai/openspec@1.2.0 openspec validate --all --strict` reports `readme-screenshots` valid (failures in agent-board-audit, european-localization and marketplace-api-contract predate this change).
- [x] Current-head CI green ([run 44809089544](https://github.com/wopee-io-demos/tazumo/actions/runs/44809089544)), independent review recorded, merged in #52 as `f047b5a`.

## Native gallery (PR 2)
- [x] `.github/workflows/screenshots.yml`: web job, iOS simulator job (hosted macos-15, Release simulator build, iPhone 16 Pro on iOS 26.2) and Android emulator job (ubuntu-latest + KVM, API 34 x86_64, release-variant APK); Maestro 1.41.0 taps, platform-tool screenshots, pngquant, artifacts. Evidence: [run 44811016593](https://github.com/wopee-io-demos/tazumo/actions/runs/44811016593) on `e7c1390` and [run 44817080915](https://github.com/wopee-io-demos/tazumo/actions/runs/44817080915) on `b925225`, all jobs success.
- [x] Android status bar: run 44811016593 showed a real clock; re-applying demo mode before each screencap gives a clean 9:41 in run 44817080915 (PNGs opened).
- [x] PNGs and `provenance.json` of run 44817080915 copied into `docs/screenshots/ios/` and `docs/screenshots/android/`; `SHA256SUMS` computed from the downloaded artifacts and verified with `shasum -a 256 -c`. All four PNGs opened: real app, catalogue and cart with subtotal €46.20.
- [x] Independent review of `b925225`: no blockers. Addressed: PNGs from the current-head run, README regenerate command uses `-D` per platform, checksums (committed `SHA256SUMS`; new runs write `pngSha256` and resolved Expo/React Native versions into `provenance.json`), Maestro downloaded from a pinned release with sha256 check, emulator action pinned to a commit SHA, numeric iOS runtime sort, iOS SDK/runtime stated, udid passed as an argument, Android light mode forced.
- [x] Current-head CI green ([run 44824056454](https://github.com/wopee-io-demos/tazumo/actions/runs/44824056454)), two independent review passes, merged in #57 as `cdf4c54`.

## Gallery refresh after #45, #50, #80, #81 (PR #127)
- [x] Web gallery recaptured on capture commit `1863730` (web SUT `be970e2`) with merchant-detail and product-detail captures added, including the sign-in notice and Favourites; 12/12 captures passed; every PNG opened.
- [x] Native flows extended to the product screen and the cart screen from #45 (`product-detail.yaml`, `back-to-catalogue.yaml`, `cart-screen.yaml`), using canonical `sut-*` testIDs.
- [x] Android PNGs from [run 44902715301](https://github.com/wopee-io-demos/tazumo/actions/runs/44902715301) on `7e629c3` (SUT `be970e2`) committed byte-identical with `SHA256SUMS` (matches `pngSha256` in provenance); all four opened: catalogue, product, inline basket, cart screen, clean 9:41 status bar.
- [ ] iOS product and cart-screen PNGs (iOS flow code unverified until the first green iOS run): blocked by the iOS 27 launch crash (#171) until #172 pins the capture to iOS 26.x; iOS gallery stays on run 44817080915 (pre-#45) and says so.
- [x] README regenerate block removes old files before `gh run download` and rebuilds `SHA256SUMS`; provenance splits `os` and `toolchain`.
- [ ] Current-head CI green, independent review recorded, merged; merge SHA on #37.

## Downstream
- [x] One `status:backlog` issue per downstream repo: mobile-agent#15, mobile-demo#10, web-demo#12, web-demo-pw-cli#12.
