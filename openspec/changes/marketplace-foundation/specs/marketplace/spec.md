# Marketplace delta specification

## ADDED Requirements

### Requirement: Category browsing
The demonstration marketplace SHALL offer Food, Groceries, Shops, and Gifts categories and an All view.

#### Scenario: Filter by category
- **WHEN** a user selects Groceries
- **THEN** only grocery-category products are displayed

### Requirement: Search
The app SHALL filter displayable fixtures by product name, merchant, or description, case-insensitively.

#### Scenario: Search matching a merchant
- **WHEN** a user searches for a merchant term
- **THEN** matching products are shown

### Requirement: Cart arithmetic
The cart SHALL keep nonnegative integer quantities and calculate totals from price cents.

#### Scenario: Remove beyond zero
- **WHEN** the user decrements a product quantity below zero
- **THEN** the product is removed from the cart and the total remains nonnegative

### Requirement: Prototype transparency
The UI SHALL clearly disclose that catalogue pricing is illustrative and no real checkout is available.

#### Scenario: User opens cart
- **WHEN** the cart contains items
- **THEN** a subtotal and explicit disabled-checkout notice are shown

### Requirement: Independent branding
The user interface SHALL load brand name, selected palette, and mascot concept independently.

#### Scenario: Change palette
- **WHEN** the palette changes
- **THEN** brand color tokens change without changing catalogue contents, name, or cart
