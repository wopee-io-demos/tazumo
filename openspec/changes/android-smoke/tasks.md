# Tasks

- [x] Case `apps/mobile/tests/android-smoke.case.json` and negative case in mobile-agent format.
- [x] Dependency-free Appium runner `apps/mobile/tests/run-case.mjs`; `pnpm --filter @tazumo/mobile test` passes locally (fake WebDriver server: pass, missing element, `--expect-fail`; case IDs present in source).
- [x] `android-smoke` job in `native-builds.yml` (hosted ubuntu-latest, KVM, API 34 x86_64 emulator, Appium 3.9.0 + UiAutomator2 8.7.3).
- [ ] CI run on the PR head: smoke case passes, negative check fails as expected, artifacts uploaded.
- [ ] Independent review findings resolved; merge SHA recorded on #59, #4 and #9.
