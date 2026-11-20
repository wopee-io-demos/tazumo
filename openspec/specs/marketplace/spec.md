# Marketplace specification

## Purpose
Enable shoppers to explore local businesses, find products and build a basket across web and mobile.

### Requirement: Cross-platform discovery
The system SHALL expose shared catalogue and categories for web, iOS and Android.

#### Scenario: Shopper searches products
- **WHEN** a shopper enters a query
- **THEN** matching products are displayed by title/description.
- **AND** nonmatching products are omitted.

### Requirement: Category filtering
The system SHALL offer Food, Groceries, Shopping and Gifts as category facets.

#### Scenario: Shopper chooses Groceries
- **WHEN** the Groceries category is selected
- **THEN** only grocery products are shown.

### Requirement: Cart quantity management
The system SHALL allow shoppers to increment and decrement cart quantities without negative values.

#### Scenario: Shopper removes final unit
- **WHEN** the quantity of an item reaches zero
- **THEN** the item is removed from the basket.

### Requirement: Honest prototype state
The system SHALL disclose synthetic merchants and prices and SHALL NOT offer simulated production checkout or courier tracking.

#### Scenario: Shopper requests checkout
- **WHEN** the prototype cart is opened
- **THEN** checkout is clearly unavailable.
