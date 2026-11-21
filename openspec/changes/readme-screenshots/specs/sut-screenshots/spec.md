# SUT reference screenshots

## ADDED Requirements

### Requirement: Web captures come from the real production build
The repository SHALL provide one command that builds the web app, serves the production bundle and captures desktop and mobile PNGs of the catalogue, a category filter, search results and a cart containing items.

#### Scenario: Regenerate the web gallery
- **WHEN** a maintainer runs `bash scripts/capture-web-screenshots.sh` after `pnpm install` and `pnpm exec playwright install chromium`
- **THEN** the PNGs in `docs/screenshots/web/` are replaced from the served build and `provenance.json` records the SUT commit, capture commit, browser version, viewports and capture time

#### Scenario: App does not render correctly
- **WHEN** the catalogue heading, expected product count or cart subtotal is not visible, the page logs an error, or the web fonts did not load
- **THEN** the capture fails and the committed gallery and its provenance are left unchanged

### Requirement: Screenshots are deterministic
Captures SHALL use a fixed app language (EN), browser locale, timezone, colour scheme, clock and reduced motion, with animations and the caret disabled.

#### Scenario: Repeat capture on the same host
- **WHEN** the command runs twice on the same commit and host
- **THEN** the resulting PNGs are byte-identical

### Requirement: Gallery states its provenance and limits
The README gallery SHALL embed the committed PNGs and state the SUT commit, fixture data, capture command or workflow run, browser or device, viewport and date. It SHALL state that the images are SUT reference imagery, not test verdicts, and name any platform that has not been captured.

#### Scenario: UI changes after capture
- **WHEN** later commits change the UI
- **THEN** the gallery still names the commit it reflects and the command that regenerates it

### Requirement: Committed images stay small
Each committed PNG SHALL be optimised and stay under about 300 KB.

#### Scenario: Optimise and enforce the size limit
- **WHEN** the capture script runs
- **THEN** it quantises every PNG with `pngquant`, records the optimiser version in `provenance.json`, and fails without touching the gallery if `pngquant` is missing or any PNG exceeds 300 KB

### Requirement: Native captures come from simulator and emulator builds in CI
The `SUT screenshots` workflow SHALL build the Expo app for the iOS simulator and the Android emulator on hosted runners, install and launch `io.wopee.demos.tazumo`, drive it to the catalogue and to a cart with items, capture with `xcrun simctl io screenshot` and `adb exec-out screencap`, and upload the PNGs with a `provenance.json` that names the workflow run, SUT commit, device, OS and build.

#### Scenario: Publish native captures
- **WHEN** a maintainer copies native PNGs into `docs/screenshots/ios/` or `docs/screenshots/android/`
- **THEN** they are byte-identical to the artifact of the workflow run cited in the README

#### Scenario: App does not reach the expected state
- **WHEN** the catalogue text, the cart button or the subtotal €46.20 is not found
- **THEN** the job fails and uploads no screenshot artifact for that platform
