# Android smoke delta specification

## ADDED Requirements

### Requirement: Android emulator smoke path
CI SHALL install a CI-built release-variant APK of `io.wopee.demos.tazumo` on an Android emulator and verify browse, product detail, add to cart and the cart screen through stable `sut-` identifiers, on every pull request that changes the native app or shared packages.

#### Scenario: Smoke path passes
- **WHEN** the case opens `sut-open-product-pizza`, taps `sut-detail-add` and taps `sut-nav-cart`
- **THEN** `sut-detail-quantity` reads "In your cart: 1", `sut-cart-line-pizza` is shown, `sut-cart-subtotal` reads "Subtotal €11.90" and `sut-cart-checkout-disabled` is not enabled

#### Scenario: Missing identifier fails the job
- **WHEN** a case step references an identifier the app does not render
- **THEN** the runner fails that step, writes the failure screenshot and UI tree, and exits non-zero

### Requirement: Smoke evidence artifacts
The smoke job SHALL upload, on success and on failure, the APK, a screenshot and UiAutomator XML for every step, a `report.json` and the Appium log.

#### Scenario: Reviewer inspects a run
- **WHEN** a reviewer downloads the `tazumo-android-smoke` artifact
- **THEN** they can see each step's status, the locator that matched and the screen at that step
