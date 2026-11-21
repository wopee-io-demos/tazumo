# Native contract walk delta specification

## ADDED Requirements

### Requirement: Every native contract ID resolves on Android
The Android contract walk SHALL resolve every `native.selectors` ID and every `native.selectorTemplates` instance for the fixture values by the Appium `id` strategy with `disableIdLocatorAutocompletion: true`, on the screen the walk plan assigns to it.

#### Scenario: Complete app
- **WHEN** the walk runs against the release APK on an emulator
- **THEN** every expected ID is resolved, its saved UiAutomator XML tree contains the ID as `resource-id`, and the verifier exits 0

#### Scenario: ID missing from the app
- **WHEN** a contract ID is not rendered on its screen
- **THEN** the walk reports it as missing and both the walk and the verifier exit non-zero

#### Scenario: Contract key without a screen
- **WHEN** the contract gains a native key that the walk plan does not assign to a screen and that is not in `native.requiresAuth`
- **THEN** the walk fails before driving the app

#### Scenario: Provider-only sign-in IDs
- **WHEN** the walk runs on a build without an identity provider
- **THEN** every `native.requiresAuth` ID is absent from the catalogue tree, `authUnavailable` resolves, and a rendered provider-only ID fails the walk

### Requirement: Fail-closed evidence
The verifier SHALL fail when the report is missing, is for another contract version, did not use `disableIdLocatorAutocompletion`, has zero assertions, lacks an expected ID, references a tree that does not contain that ID, or does not prove every checkout control disabled.

#### Scenario: Checkout enabled
- **WHEN** a checkout control reports `enabled: true`
- **THEN** the walk fails and the verifier fails
