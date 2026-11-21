# Order quotes

## ADDED Requirements

### Requirement: Authoritative quote from server data
The service SHALL compute quotes only from prices, currencies and VAT categories stored in its database, with `@tazumo/commerce` rules for the market's country. It SHALL label fees and distance as synthetic and VAT rates as data to re-verify.

#### Scenario: Mixed-rate basket
- WHEN an SK basket with food, groceries and electronics is quoted
- THEN the response lists VAT per rate, `tax` is the sum of the VAT groups, `total` equals the sum of their gross amounts, and the components marked `addsToPayable` sum to `payable`.

#### Scenario: Cash rounding
- WHEN a CZK basket is quoted for cash
- THEN `payable` is whole crowns, a `rounding` component explains the difference, and `total` stays exact. A card quote has no rounding.

#### Scenario: Client-supplied prices
- WHEN a request carries prices or VAT categories
- THEN they do not affect the quote.

### Requirement: Explicit refusals
The service SHALL refuse to quote instead of guessing.

#### Scenario: Unsupported market
- WHEN the market row's country has no commerce rules, as for the seeded IE demo market
- THEN the response is 422 `unsupported_market`.

#### Scenario: Invalid basket or delivery
- WHEN a product is unknown, a quantity is out of range, a line is duplicated, or the delivery is beyond the last band or in another country
- THEN the response is 404, 400 or 422 respectively, with an `ApiError`.
