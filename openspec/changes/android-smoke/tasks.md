# Tasks

- [x] Case `apps/mobile/tests/android-smoke.case.json` and negative case in mobile-agent format.
- [x] Dependency-free Appium executor `apps/mobile/tests/run-case.mjs` mirroring `native.py`. `pnpm --filter @tazumo/mobile test` passes locally (fake device and fake WebDriver server). Covered: pass with click order, missing element, ambiguity, infrastructure failure, `absent`/`type`, the `--expect-fail` CLI and case IDs present in the source.
- [x] `android-smoke` job in `native-builds.yml` (hosted ubuntu-latest, KVM, API 34 x86_64 emulator, Appium 3.9.0 + UiAutomator2 8.7.3).
- [ ] CI run on the PR head: smoke case passes, negative check fails as expected, artifacts uploaded.
- [ ] Independent review findings resolved; merge SHA recorded on #59, #4 and #9.
