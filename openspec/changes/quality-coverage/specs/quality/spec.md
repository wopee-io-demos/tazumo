## ADDED Requirements

### Requirement: Fixture contract conformance
The test suite SHALL validate every synthetic product and merchant exported by `@tazumo/core` against the schemas in `contracts/openapi.json`, and SHALL reject malformed products.

#### Scenario: Fixtures conform
- **WHEN** `pnpm test:contract` runs
- **THEN** every projected product validates as `Product` and as a merchant products response, and every derived merchant validates as `Merchant` with `acceptingOrders` false and no delivery estimate.

#### Scenario: Malformed product
- **WHEN** a product has a negative or fractional price, a lower-case currency, an unknown `Money` property, a missing name or availability, or a non-UUID identifier
- **THEN** validation fails with the matching schema keyword.

### Requirement: Automated accessibility gate
The browser suite SHALL run axe-core with WCAG 2.0, 2.1 and 2.2 A/AA rules on the catalogue in every palette, search results, empty search results and the cart, and SHALL fail on serious or critical violations that the issue-linked baseline does not list.

#### Scenario: New violation
- **WHEN** a serious or critical violation appears that is not listed for that scan, or a listed rule hits more nodes than its limit
- **THEN** the test fails and the report lists the rule, impact and targets.

#### Scenario: Baseline is documented
- **WHEN** a baseline entry exists
- **THEN** it names a serious or critical rule, a node limit, a reason and a Tazumo issue URL; entries that no longer reproduce are reported.

### Requirement: Failure scenario coverage
The browser suite SHALL cover a search without results, an unknown route and cart quantity edge cases without uncaught page errors.

#### Scenario: No search results
- **WHEN** a query matches nothing
- **THEN** the empty-state status is shown, no product cards render, and clearing the query restores the full catalogue.

#### Scenario: Unknown route
- **WHEN** a user opens a path the app does not define
- **THEN** the app shell renders without page errors and the home link returns to the catalogue.

#### Scenario: Cart line reaches zero
- **WHEN** one of two cart lines is decremented to zero
- **THEN** only that line is removed, counts never go negative, the subtotal updates and checkout stays disabled.

### Requirement: CI test evidence
CI SHALL upload the Playwright HTML report and screenshots for every run, whether it passes or fails.

#### Scenario: Passing run
- **WHEN** the test evidence workflow passes
- **THEN** the `playwright-report` and `playwright-test-results` artifacts are available on the run.
