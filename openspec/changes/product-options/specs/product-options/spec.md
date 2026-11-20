# Product options delta specification

## ADDED Requirements

### Requirement: Option group definitions
The `@tazumo/product-options` package SHALL validate a product's option groups and return every problem as an error with a distinct code and a path to the offending field.

#### Scenario: Inconsistent bounds
- **WHEN** a group has `min` greater than `max`, `max` greater than its option count, or `selection: 'single'` with `max` other than 1
- **THEN** `validateOptionGroups` returns `min_exceeds_max`, `max_exceeds_options` or `single_max_not_one` with the path of that field

#### Scenario: Duplicate identifiers
- **WHEN** two groups share an ID, or two options of the product share an ID
- **THEN** `validateOptionGroups` returns `duplicate_group_id` or `duplicate_option_id` with the path of the second occurrence

#### Scenario: Unsafe price delta
- **WHEN** an option's `priceDeltaMinor` is not a safe integer
- **THEN** `validateOptionGroups` returns `invalid_price_delta`

### Requirement: Selection validation
The package SHALL validate a selection against a definition, apply available defaults to groups that are left out, and reject invalid choices with distinct codes.

#### Scenario: Required group with a default
- **WHEN** a required single-choice group with an available default is left out of the selection
- **THEN** the default is selected

#### Scenario: Invalid choices
- **WHEN** a selection names an unknown group, an unknown option, an option from another group, the same option twice, too few or too many options, an unavailable option, or leaves out a required group with no available default
- **THEN** it is rejected with `unknown_group`, `unknown_option`, `option_wrong_group`, `duplicate_option`, `too_few_options`, `too_many_options`, `option_unavailable` or `missing_required_group` and the path of the group or option

### Requirement: Integer pricing
The package SHALL price a valid selection in integer minor units and return the unit price, the line total and a per-option breakdown in the definition's currency.

#### Scenario: Multiple choice with a negative delta
- **WHEN** a selection picks a negative-delta size and up to three extras
- **THEN** the unit price is the base price plus all deltas and the line total is the unit price times the quantity

#### Scenario: Invalid amounts
- **WHEN** the base price is not a non-negative safe integer, its currency differs from the definition, the quantity is not a positive safe integer, the unit price falls below zero or the line total leaves the safe integer range
- **THEN** pricing fails with `invalid_base_price`, `currency_mismatch`, `invalid_quantity`, `negative_unit_price` or `amount_overflow`

### Requirement: Canonical cart line key
The package SHALL produce a cart line key that is identical for the same product and selection in any order and differs for different selections.

#### Scenario: Reordered selection
- **WHEN** the same groups and options are given in a different order
- **THEN** `lineKey` returns the same key
