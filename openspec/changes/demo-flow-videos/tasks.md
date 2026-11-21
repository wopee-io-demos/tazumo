# Tasks

- [x] Case file, web spec, mobilecli executor with 12 unit tests (failure paths included), Android recorder script and workflow. Local on macOS, Node 22: `pnpm typecheck`, `pnpm test`, `pnpm build`, `node --test tests/demo/run-case.test.mjs` pass.
- [x] Web video, browser evidence: Playwright 1.65.1 Chromium at 390x844 against `vite preview` of the production build of `cdf4c54`; `pnpm exec playwright test -c tests/demo/playwright.config.ts` 1/1 passed. CI web job also passes and uploads `tazumo-flow-web.mp4`.
- [x] iOS video, native simulator evidence (local): iPhone 17 simulator, iOS 26.5, app shell from Native development builds run 44810792812 (debug), JS of `cdf4c54` served by Metro with `dev=false`; mobile-agent `mobilecli.py` (mobile-agent `c844f30`, mobilecli 1.0.24) `passed` 7/7; final UI dump contains `Margherita pizza × 1`, `Subtotal €11.90` and the checkout-disabled note. Recorded with `simctl io recordVideo`.
- [x] Android video, CI emulator evidence: `demo-videos.yml` run 44875997408 (head `2e3ab8d`, app sources of `cdf4c54`), API 34 x86_64 `pixel_7` emulator, release APK, mobilecli 1.0.24: `passed` 6/6 with all three final texts on screen; mp4 uploaded as `tazumo-demo-video-android`.
- [x] Independent review (two passes, `b671dbc` and `2e3ab8d`); findings fixed in the PR.
- [ ] Current-head CI green, merged, merge SHA recorded in #70.
