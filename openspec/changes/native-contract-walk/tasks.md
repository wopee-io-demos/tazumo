# Native contract walk tasks

Issue #32 (slice), branch `test/32-android-contract-walker`.

- [x] Walk plan covering every native key of the contract, up to v0.5.0: 37 unique IDs over 8 screens, the last six following the `native-detail-cart` journey steps. The 7 `native.requiresAuth` sign-in IDs from v0.5.0 are asserted absent on the provider-less CI build, which brings the checks to 16.
- [x] Walker, independent verifier and emulator script.
- [x] Fake-WebDriver tests (16) over a model of the app: a scrolling viewport, the nested horizontal pill list, cold-start and transition delays, and text that updates a few polls after a tap. They cover:
  - a complete walk, and missing IDs (including an off-screen pill)
  - an enabled checkout, a stale cart line, Appium not ready, settings not applied, screenshot errors
  - an unplanned contract key, and a checkout control without a disabled check
  - each verifier guard: wrong text in the tree, a line still in the tree, evidence from another screen, evidence errors, an assertion count off by one, a tampered tree, a foreign report
  - XML entity decoding, and both CLIs over a fake HTTP Appium

  `pnpm --filter @tazumo/mobile test` passes all walker tests (19) locally on Node 22.19, including a linear-time check of the XML tree scanner on pathological input.
- [x] Mutation runs: removing the anchor wait, the tree-based gone check, the scroll to the pill list, the text polling, the checkout guard, or any of the verifier's tree, screen, evidence or count guards each makes at least one test fail.
- [x] Independent review, two passes (683ad3a, e2e68f0): no blockers. The code findings are fixed; the emulator run (below) is still open.
- [ ] Add one step to the android-smoke job after #128 merges (coordinate with A3 on #128 or #64), and upload the per-screen XML trees.
- [ ] Current-head CI on the emulator: every native ID resolved and the verifier OK.
