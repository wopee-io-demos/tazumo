# Cross-platform canonical SUT specification

## Requirement: Stable automation surface
The Tazumo demo clients SHALL expose consistent `sut-*` selectors for search, product discovery, adding products, cart and language selection on web, iOS and Android.

### Scenario: Localized label changes
- WHEN the interface language changes between English, Czech and German
- THEN stable automation identifiers SHALL remain unchanged while screen-reader labels can be localized.

## Requirement: Synthetic checkout honesty
The SUT SHALL keep the checkout action disabled while payments, merchants and fulfilment are not implemented.

### Scenario: Demo adds a pizza
- WHEN a demo adds Margherita pizza and opens the cart
- THEN the user sees the fixture product and price but SHALL NOT be able to perform a real payment or place an order.

## Requirement: Safe versioned integrations
Automation consumers SHALL pin `contracts/sut.json` schema and semantic version, and an intentional selector change SHALL require coordinated updates to all four Wopee demo repositories.

### Scenario: Selector removed
- WHEN a stable selector is removed from the web or native UI
- THEN the CI contract validation SHALL fail until the cross-platform contract and consumers are updated.
