# Tasks

## Web gallery (PR 1)
- [x] Capture spec `tests/screenshots/capture.spec.ts` with fixed locale, timezone, scheme, clock, reduced motion; asserts catalogue heading, product counts, cart subtotal €46.20, loaded web fonts and no page/console errors before each capture. Font check verified to fail when Google Fonts are blocked (no loaded faces). Evidence: 8/8 captures passed locally (Playwright 1.65.1, Chromium 159.0.8154.6, macOS arm64).
- [x] `scripts/capture-web-screenshots.sh` builds, serves `vite preview`, captures into a temp dir, quantises with pngquant 3.0.3 (required), enforces 300 KB per PNG, writes `provenance.json` and only then replaces `docs/screenshots/web/`. Evidence: two consecutive runs on SUT `b1cd347` produced byte-identical PNGs (md5 compared); largest file 121,680 bytes.
- [x] Every committed web PNG opened and checked: real app, no error page, blank screen or spinner.
- [x] README gallery with provenance table and the "reference imagery, not test verdicts" statement.
- [x] Local checks: `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` passed; `npx --yes --package @fission-ai/openspec@1.2.0 openspec validate --all --strict` reports `readme-screenshots` valid (failures in agent-board-audit, european-localization and marketplace-api-contract predate this change).
- [x] Current-head CI green ([run 44809089544](https://github.com/wopee-io-demos/tazumo/actions/runs/44809089544)), independent review recorded, merged in #52 as `f047b5a`.

## Native gallery (PR 2)
- [x] `.github/workflows/screenshots.yml`: web job, iOS simulator job (hosted macos-15, Release simulator build, iPhone 16 Pro / iOS 26.2) and Android emulator job (ubuntu-latest + KVM, API 34 x86_64, release-variant APK); Maestro 1.41.0 taps, platform-tool screenshots, pngquant, artifacts. Evidence: [run 44811016593](https://github.com/wopee-io-demos/tazumo/actions/runs/44811016593) on `e7c1390`, all three jobs success.
- [x] CI PNGs copied into `docs/screenshots/ios/` and `docs/screenshots/android/` with their `provenance.json`; sha256 of committed files equals the downloaded artifacts. All four PNGs opened: real app, catalogue and cart with subtotal €46.20.
- [x] Android status bar demo mode re-applied right before each screencap (run 44811016593 showed a real clock); validated by the current-head run, committed PNGs stay those of run 44811016593.
- [ ] Current-head CI green, independent review recorded, merged; merge SHA on #37.

## Downstream
- [x] One `status:backlog` issue per downstream repo: mobile-agent#15, mobile-demo#10, web-demo#12, web-demo-pw-cli#12.
