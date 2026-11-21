# Native contract walk tasks

Issue #32 (slice), branch `test/32-android-contract-walker`.

- [x] Walk plan covering every native key of contract v0.2.0 (36 unique IDs over 7 screens, including the `native-detail-cart` journey).
- [x] Walker, independent verifier and emulator script.
- [x] Fake-WebDriver tests: complete walk, missing IDs, enabled checkout, Appium not ready, unplanned contract key, tampered or foreign report, and the CLIs over a fake HTTP Appium (`pnpm --filter @tazumo/mobile test`, locally on Node 22.19).
- [ ] Add one step to the android-smoke job after #128 merges (coordinate with A3 on #128 or #64), and upload the per-screen XML trees.
- [ ] Current-head CI on the emulator: every native ID resolved and the verifier OK.
