# Mobile build delta specification

## ADDED Requirements

### Requirement: Debug bundles build with patched dependencies
The Expo app SHALL build iOS and Android debug (development) bundles with Metro while every `image-size` consumer resolves to a release that contains the fixes for GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq and GHSA-m5qc-5hw7-8vg7.

#### Scenario: Debug bundle with image assets
- **WHEN** `expo export --dev` bundles the app, including React Native's PNG assets
- **THEN** the export succeeds and image dimensions come from the patched image-size 2.x parser

#### Scenario: Regression guard
- **WHEN** a change breaks Metro debug bundling
- **THEN** `pnpm bundle:mobile` in the required `check` job fails
