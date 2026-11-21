# Delivery address validation and geocoding (slice 1)

## Why
Issue #94 (gap found in #26). The contract has `DeliveryAddress`, and `@tazumo/merchant-ops` (PR #76) can check a point against delivery zones, but nothing validates an address for its market or turns it into a point. The prototype accepted any free text and counted unknown addresses as deliverable.

## What changes
- ADR-0023: geocoding provider comparison (public and self-hosted Nominatim, Photon/Pelias, Mapbox, Google, HERE, postal-code centroids, no geocoding) with a recommendation; the decision is left to the owner.
- New pure package `@tazumo/address`:
  - `validateAddress(market, input)` and `normalizeAddress` for SK, CZ, DE and AT, with path-addressed errors.
  - `Geocoder` port and a deterministic, offline `FixtureGeocoder` for fictional addresses.
  - `resolveAddressDelivery` combining validation, geocoding and `checkDelivery`.
  - `redactAddress` for logs.
- Drift tests against `contracts/openapi.json`, `@tazumo/merchant-ops` (`checkDelivery`) and `@tazumo/commerce` (`marketCodes`); the last two run once those packages are on main.

## Out of scope
Web and native address entry (slice 2), quote eligibility (slice 3), deploying a live geocoder, a saved address book, maps and routing.

## Tracking
Issue #94, ADR-0023, ADR-0019 (PR #76), issue #11 (PR #80).
