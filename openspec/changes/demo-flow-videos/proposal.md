# Demo flow videos on web, iOS and Android

## Why
Issue [#70](https://github.com/wopee-io-demos/tazumo/issues/70): the repository owner wants to see the same Tazumo flow running on all three implementations. Silent videos of one short flow, recorded with the demo tooling the organisation already builds, show that quickly.

## What Changes
- `tests/demo/flow-search-add-cart.json`: one mobile-agent case for iOS and Android. It searches for `Margherita`, adds the pizza, opens the cart and ends on the cart line. Elements are addressed by English accessibility labels from `@tazumo/core`, because the native controls this flow uses (search field, Add, the header cart button and the inline basket) have no `testID` yet (#53).
- `tests/demo/flow.spec.ts` and its own Playwright config: the same flow in Chromium at 390x844 against `vite preview` of the production build, with video on and human-paced pauses. It asserts the cart through the web `sut-cart-*` test IDs.
- `tests/demo/run-case.mjs` and `android-video.sh`: a small executor that runs the Android half of the case through the mobilecli CLI with the locator semantics of mobile-agent's mobilecli backend (mobile-agent is private, so its runner cannot be fetched in public CI), and a script that records the Android emulator with `adb shell screenrecord`.
- `.github/workflows/demo-videos.yml`: on manual dispatch, or a pull request that touches `tests/demo/**` or the workflow, records the web video and builds a release-variant Android APK, boots an emulator with KVM, runs the flow and uploads the mp4s.

iOS is recorded locally with mobile-agent's `mobilecli.py` runner and `simctl io recordVideo`. The hosted macOS queue is too congested to wait on.

## Impact
- Demo artefacts only. The workflow is not a merge gate for app changes, and the case does not replace the Appium native smoke gate from ADR-0010 (#9, #59).
- No app source, `testID`, contract or fixture changes. Videos stay out of git: CI artifacts and the owner's local folder.
- When #53 adds `sut-*` identifiers to the native app, the case should switch from labels to ids.
