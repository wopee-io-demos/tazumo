# SUT reference screenshots

## ADDED Requirements

### Requirement: Web captures come from the real production build
The repository SHALL provide one command that builds the web app, serves the production bundle and captures desktop and mobile PNGs of the catalogue, a category filter, search results and a cart containing items.

#### Scenario: Regenerate the web gallery
- **WHEN** a maintainer runs `bash scripts/capture-web-screenshots.sh` on a clean checkout
- **THEN** the PNGs in `docs/screenshots/web/` are rewritten from the served build and `provenance.json` records the SUT commit, browser version, viewports and capture time

#### Scenario: App does not render
- **WHEN** the catalogue heading, expected product count or cart subtotal is not visible
- **THEN** the capture fails and no screenshot for that state is written

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

#### Scenario: Optimiser available
- **WHEN** `pngquant` is installed
- **THEN** the capture script quantises every PNG and records the optimiser version in `provenance.json`
