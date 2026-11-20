## ADDED Requirements

### Requirement: One demo flow on every implementation
The repository SHALL define one shopping flow (search `Margherita`, add `Margherita pizza`, open the cart, show one pizza, `Subtotal €11.90` and the checkout-disabled note) for the web app in `tests/demo/flow.spec.ts` and for iOS and Android in the mobile-agent case `tests/demo/flow-search-add-cart.json`, using the same English accessibility labels.

#### Scenario: Same flow on iOS and Android
- **WHEN** the case's iOS and Android steps are compared, ignoring the iOS keyboard `Return` tap
- **THEN** they are identical and both end by asserting `Remove one Margherita pizza`, a control that only exists in the open cart.

#### Scenario: Web flow reaches the cart
- **WHEN** `pnpm exec playwright test -c tests/demo/playwright.config.ts` runs against the production build
- **THEN** the cart dialog shows one `Margherita pizza` line with quantity 1, `€11.90`, the checkout-disabled note and a disabled checkout button, and a video is recorded.

### Requirement: Android video in CI
`.github/workflows/demo-videos.yml` SHALL build a release-variant APK with the JS bundled, run the flow on a hosted emulator through the mobilecli CLI, record it with `adb shell screenrecord` and upload the mp4.

#### Scenario: Flow passes
- **WHEN** every step finds its element and the final screen contains `Margherita pizza × 1`, `Subtotal €11.90` and the checkout-disabled note
- **THEN** the job passes and uploads `tazumo-flow-android.mp4`, `report.json` and `ui.json`.

#### Scenario: Element missing
- **WHEN** a step's label is not found within 20 seconds, a locator matches two controls in different places, or a final text is missing
- **THEN** the executor exits non-zero, the job fails, and the report and UI dump are still uploaded.

### Requirement: Videos are silent and kept out of git
Demo videos SHALL have no audio track, no burned-in badge or disclaimer, and SHALL NOT be committed to the repository.

#### Scenario: Output
- **WHEN** the web and Android jobs finish
- **THEN** the mp4s are H.264 without an audio stream and exist only as workflow artifacts.
