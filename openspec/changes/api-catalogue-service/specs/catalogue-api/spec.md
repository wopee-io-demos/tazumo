# Catalogue API

## ADDED Requirements

### Requirement: Versioned catalogue schema
The service SHALL manage its PostgreSQL schema with ordered, reversible, versioned migrations, and SHALL store prices as non-negative integer minor units with an ISO 4217 currency code.

#### Scenario: Fresh and repeated migration
- WHEN migrations run against an empty database and then run again
- THEN the catalogue tables exist and the second run applies nothing.

#### Scenario: Invalid money is rejected
- WHEN a product is written with a negative or fractional price or a currency that is not three upper-case letters
- THEN the database rejects the write.

### Requirement: Synthetic fixture seed
The service SHALL seed markets, categories, merchants and products from the `@tazumo/core` fixtures idempotently, preserving each fixture product ID as the product slug and marking every record as synthetic.

#### Scenario: Pizza fixture
- WHEN the seed has run any number of times
- THEN exactly one product has slug `pizza`, priced 1190 minor units in EUR.

### Requirement: Contract-valid discovery endpoints
The service SHALL serve the read-only Discovery operations of `contracts/openapi.json` with bodies that validate against the contract, and SHALL NOT present synthetic merchants as accepting orders or promise delivery times.

#### Scenario: List merchants in a market
- WHEN a client requests `GET /v1/merchants?marketCode=demo-eu`
- THEN the response validates against the contract and every merchant has `acceptingOrders: false`, `deliveryEtaMinutes: null` and `synthetic: true`.

#### Scenario: Invalid input
- WHEN `marketCode` is missing, malformed or unknown, or `merchantId` is not a UUID
- THEN the service responds 400 with an `ApiError` body carrying the request ID.

#### Scenario: Unknown merchant
- WHEN `merchantId` is a well-formed UUID with no merchant
- THEN the service responds 404 with an `ApiError` body.

### Requirement: Operational safety basics
The service SHALL log without query strings, client IP addresses, authorization or cookie headers, SHALL hide internal error details from clients and logs, and SHALL expose a health endpoint reflecting database reachability.

#### Scenario: Database unreachable
- WHEN the database cannot be reached
- THEN `GET /health` responds 503.
