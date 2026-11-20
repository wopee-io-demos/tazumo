# Commerce rules

## ADDED Requirements

### Requirement: Market configuration
The commerce package SHALL define SK, CZ, DE and AT markets with currency, locale, VAT-inclusive display, VAT rates in basis points with a default rate per VAT category, a platform fee rate, payable rounding and synthetic fee rules, and SHALL reject unknown markets and inconsistent configurations.

#### Scenario: Launch markets
- WHEN `getMarket` is called with `SK`, `CZ`, `DE` or `AT`
- THEN it returns EUR, CZK, EUR and EUR markets with locales `sk-SK`, `cs-CZ`, `de-DE` and `de-AT`, all VAT-inclusive

#### Scenario: Unknown market
- WHEN `getMarket` is called with any other code, including `__proto__` or a lower-case code
- THEN it throws `unknown_market`

#### Scenario: Rates are cited and flagged
- WHEN any VAT rate is read
- THEN it cites at least one national official source with a retrieval date (plus the EU overview where that page lists the rate), and the market VAT data has status `reverify`

### Requirement: Price breakdown
The commerce package SHALL compute lines, subtotal, delivery fee, small-order surcharge, VAT per rate, total and payable amount in integer minor units, and SHALL explain every component.

#### Scenario: Mixed VAT rates
- WHEN an SK basket holds a delivered meal, electronics and a basic food with the 5 % override
- THEN VAT is reported separately for 23 % (electronics and fees), 19 % and 5 %, and the components with `addsToPayable` sum to the payable amount, which is always the last component

#### Scenario: Rate overrides are limited per category
- WHEN a line names a `vatRateId` that is neither its category default nor an allowed override for that category (for example AT 4.9 % on electronics or on prepared food)
- THEN the breakdown throws `unknown_vat_rate`

#### Scenario: VAT-inclusive prices
- WHEN the market shows prices VAT-inclusive
- THEN VAT per rate is `gross × rate ÷ (1 + rate)` rounded half up once per rate (an exact half rounds the VAT up), net is gross minus VAT, and VAT is not added to the total again

#### Scenario: VAT-exclusive configuration
- WHEN a market configuration sets `pricesIncludeVat: false`
- THEN VAT per rate is added to the net total

#### Scenario: CZK whole crowns
- WHEN a CZK total is not a whole crown
- THEN the payable amount is rounded half up to whole crowns, the difference is a separate rounding component, and whole-crown amounts display without halers

#### Scenario: Synthetic fees
- WHEN any breakdown is produced
- THEN delivery fee and small-order surcharge are flagged synthetic in data and explanation text, also when no surcharge applies, and `dataStatus` carries the re-verify notice

### Requirement: Input validation
The commerce package SHALL reject invalid input with a typed `CommerceRuleError` instead of guessing.

#### Scenario: Invalid quantities and prices
- WHEN a line has a zero, negative, fractional, non-finite or above-999 quantity, or a negative or fractional price
- THEN the breakdown throws `invalid_quantity` or `invalid_amount`

#### Scenario: Currency mismatch
- WHEN a line is priced in a currency other than the market currency
- THEN the breakdown throws `currency_mismatch`

#### Scenario: Other invalid input
- WHEN the order or a line is not an object, the order is empty or has more than 100 lines, `vatRateId` is not a string, the order repeats a line ID, uses an unknown VAT category or rate, has a negative or non-finite distance, lies beyond the last delivery band, or overflows the safe integer range
- THEN the breakdown throws `empty_order`, `invalid_line`, `duplicate_line`, `unknown_vat_category`, `unknown_vat_rate`, `invalid_distance`, `outside_delivery_area` or `amount_overflow`
