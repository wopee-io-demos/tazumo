# Canonical SUT delta specification

## ADDED Requirements

### Requirement: Stable automation surface
The Tazumo web, iOS and Android clients SHALL expose the `sut-*` identifiers registered in `contracts/sut.json` for search, categories, products, merchants, detail pages, cart controls and language selection, independent of interface language.

#### Scenario: Localized label changes
- **WHEN** the interface language changes between English, Czech and German
- **THEN** the registered identifiers stay unchanged while accessible labels are localized

#### Scenario: Registered ID removed from the code
- **WHEN** a registered selector or selector template no longer occurs in the platform's source files
- **THEN** `pnpm check:sut` fails and names the contract key

### Requirement: Semantic contract versions
Automation consumers SHALL be able to pin the contract `version`; the version SHALL change according to semantic versioning.

#### Scenario: Selector renamed or removed
- **WHEN** a pull request removes or changes a registered ID, template, route or fixture value
- **THEN** CI fails unless the major version is bumped

#### Scenario: Selector added
- **WHEN** a pull request only adds IDs, templates, routes, fixtures or journeys
- **THEN** CI fails unless at least the minor version is bumped

### Requirement: Synthetic checkout honesty
The SUT SHALL keep every checkout control disabled while payments, merchants and fulfilment are not implemented.

#### Scenario: Demo adds a pizza
- **WHEN** a demo adds Margherita pizza and opens the cart on any platform
- **THEN** the fixture product and price are shown and the registered checkout control is disabled
