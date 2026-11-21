# Native contract walk tasks

Issue #32 (slice), branch `test/32-android-contract-walker`.

- [x] Walk plan covering every native key of contract v0.2.0 (36 unique IDs over 8 screens; the last six follow the `native-detail-cart` journey steps).
- [x] Walker, independent verifier and emulator script.
- [x] Fake-WebDriver tests over a model of the app with a scrolling viewport, a nested horizontal list, cold start and transition delays: complete walk, missing IDs (including an off-screen pill), enabled checkout, a stale cart line, Appium not ready, settings not applied, screenshot errors, an unplanned contract key, a tampered or foreign report, and both CLIs over a fake HTTP Appium. 12 tests pass (`pnpm --filter @tazumo/mobile test`, locally on Node 22.19). Mutations (removing the anchor wait, the tree-based gone check or the scroll to the pill list, the verifier's tree check, or the handling of evidence errors) each fail at least two tests.
- [x] Independent review at 683ad3a: no blockers; the majors (the verifier could be fooled, the fake was too lenient) and the minors are fixed.
- [ ] Add one step to the android-smoke job after #128 merges (coordinate with A3 on #128 or #64), and upload the per-screen XML trees.
- [ ] Current-head CI on the emulator: every native ID resolved and the verifier OK.
