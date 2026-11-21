# Tasks

- [x] Case `apps/mobile/tests/android-smoke.case.json` and negative case in mobile-agent format.
- [x] Dependency-free Appium executor `apps/mobile/tests/run-case.mjs` mirroring `native.py`. `pnpm --filter @tazumo/mobile test` passes locally (fake device and fake WebDriver server). Covered: pass with click order, missing element, ambiguity, infrastructure failure, `absent`/`type`, the `--expect-fail` CLI and case IDs present in the source.
- [x] `android-smoke` job in `native-builds.yml` (hosted ubuntu-latest, KVM, API 34 x86_64 emulator, Appium 3.9.0 + UiAutomator2 8.7.3).
- [x] CI run on PR #79 head 0fdfd6e ([run 44823399084](https://github.com/wopee-io-demos/tazumo/actions/runs/44823399084)), Android 14 emulator:
  - all 10 smoke steps passed;
  - the negative case failed on its last step as required;
  - screenshots, UI XML per step, `report.json`, the Appium log and the APK were uploaded.

  Two earlier runs failed:
  - a system ANR dialog took focus (fixed by hiding error dialogs);
  - UiAutomator2 auto-completed bare `id` locators (fixed with the setting `disableIdLocatorAutocompletion: true`). Contract finding posted on #53.
- [x] Independent review findings resolved. Merged as bcd0104 ([#79](https://github.com/wopee-io-demos/tazumo/pull/79)); main bcd0104 Android emulator smoke and APK succeeded ([run 44874204722](https://github.com/wopee-io-demos/tazumo/actions/runs/44874204722); its iOS job was cancelled by a later push). Recorded on #59, #4 and #9.
