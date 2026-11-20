# Marketplace delta specification

## ADDED Requirements

### Requirement: Merchant discovery
The web app SHALL list synthetic merchants that match the selected category and the search query. A query matches a merchant's name or description, or the name or description of any of its products, case-insensitively.

#### Scenario: Search by product finds its merchant
- **WHEN** a user searches for "sourdough"
- **THEN** the merchant list shows Morning Market only

#### Scenario: No results
- **WHEN** no merchant or product matches the query and category
- **THEN** empty states for products and merchants are shown with a control that clears the search and category

### Requirement: Merchant and product detail routes
The web app SHALL render merchant detail at `#/merchant/<id>` and product detail at `#/product/<id>` without a server round trip, support deep links and browser history, and move focus to the page heading on navigation.

#### Scenario: Open a merchant
- **WHEN** a user activates a merchant link
- **THEN** the merchant's products, prices and add controls are shown and the heading has focus

#### Scenario: Unknown id
- **WHEN** a route references a merchant or product id that is not in the fixtures
- **THEN** a not-found message with a link back to all merchants is shown

### Requirement: Cart line editing
The cart SHALL support increasing, decreasing and removing a line. Line totals and the subtotal SHALL be integer minor units, formatted for the selected language.

#### Scenario: Remove the last item
- **WHEN** the user removes the only remaining cart line
- **THEN** the empty-basket message is shown, the subtotal and checkout control are not rendered, and focus stays inside the cart dialog

#### Scenario: Checkout remains unavailable
- **WHEN** the cart contains items
- **THEN** the checkout control is disabled and labelled as coming later
