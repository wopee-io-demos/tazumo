# Change: Android runtime walk of the native SUT contract

Issue: [#32](https://github.com/wopee-io-demos/tazumo/issues/32) (slice). Builds on the Android smoke runner from #79 and #139. ADR: not needed; this adds test tooling only, with no architectural decision.

## Why
Contract v0.2.0 native IDs are checked statically (`pnpm check:sut`). Consumers drive them with Appium `id` locators on Android, but nothing proves that each ID shows up as a resource-id in a real UiAutomator tree.

## What changes
- `apps/mobile/tests/contract-walk.mjs`: reads `contracts/sut.json` and walks catalogue, mini-cart, product detail, cart screen and the `native-detail-cart` journey. It asserts every native ID by `id` with `disableIdLocatorAutocompletion: true`, scrolling with UiScrollable only for IDs that are off screen, and checks that the checkout controls are disabled. It saves an XML tree and a screenshot per screen.
- `apps/mobile/tests/verify-contract-walk.mjs`: an independent, fail-closed verdict computed from the contract, the report and the saved trees.
- `apps/mobile/tests/android-contract-walk.sh`: the emulator entry point, which reuses a running Appium.
- Fake-WebDriver tests in `apps/mobile/tests/contract-walk.test.mjs`.

## Out of scope
iOS runtime verification (follow-up issue), a second APK pipeline (#64), and changes to `native-builds.yml` before #128 merges.
