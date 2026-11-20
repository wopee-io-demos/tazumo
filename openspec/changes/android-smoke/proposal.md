# Proposal: Android emulator smoke path in CI

Tracking issue: [#59](https://github.com/wopee-io-demos/tazumo/issues/59), for [#4](https://github.com/wopee-io-demos/tazumo/issues/4) and [#9](https://github.com/wopee-io-demos/tazumo/issues/9). Tooling follows ADR-0010 (proposed in #51): Appium UiAutomator2 runs mobile-agent cases addressed by `sut-*` IDs.

## Why
CI built only an Android debug APK. That APK needs a Metro server, and nothing launched it. Issues #4 and #9 require a passing Android emulator smoke path with artifact evidence.

## What changes
- New `android-smoke` job in `native-builds.yml` on hosted `ubuntu-latest` with KVM:
  - builds a release-variant x86_64 APK (debug keystore, JavaScript embedded);
  - boots an API 34 emulator through `reactivecircus/android-emulator-runner`;
  - installs the APK, starts Appium 3.9.0 with UiAutomator2 8.7.3 and runs `apps/mobile/tests/android-smoke.case.json`.
- `apps/mobile/tests/run-case.mjs`: a dependency-free W3C WebDriver runner for the mobile-agent case format (`tap`, `type`, `see`, `absent`). It captures a screenshot and the UiAutomator XML after every step and writes `report.json`.
- A negative case with a missing ID must fail on its last step (`--expect-fail`), so a runner that cannot fail is caught.
- Unit tests run the runner against a fake WebDriver server and check that every case ID exists in the app source.

## Scope
Android only. iOS simulator smoke, Maestro screenshots (#57) and Wopee hosted runs stay out of scope. No signing secrets: the APK is signed with the debug keystore and is not distributable.
