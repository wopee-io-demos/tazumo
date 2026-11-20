# Tasks

## Slice 1 (ADR and `@tazumo/address`)

- [x] ADR-0023 (Proposed): geocoding provider comparison with a recommendation (self-hosted Nominatim on an EU host; HERE as the no-ops fallback); the decision is left to the owner because it needs a host or an account.
- [x] `validateAddress` / `normalizeAddress` for SK, CZ, DE, AT. Evidence: `src/address.test.ts` (valid per market with diacritics, idempotent normalization, wrong postal format per market, unsupported country, market mismatch, missing/blank city and line 1, over-length fields, unknown fields, wrong types, control characters).
- [x] `Geocoder` port, `FixtureGeocoder`, `resolveAddressDelivery`. Evidence: `src/geocoder.test.ts` (stable points, one SK fixture inside and one outside the synthetic zone, `not_found` for near-miss and real-looking addresses, invalid input never reaches the geocoder, returned points are copies).
- [x] `redactAddress`. Evidence: `src/redact.test.ts`, a seeded property test over 2,000 generated addresses.
- [x] Drift tests in `src/drift.test.ts`: contract `DeliveryAddress` fields, required set and `maxLength`; `checkDelivery` against `@tazumo/merchant-ops`; `addressMarkets` against `@tazumo/commerce` `marketCodes`. The last two skip until PR #76 and PR #80 are on main. Evidence: run locally against the PR heads' sources (3/3 pass), and a mutation (removing zone validation, adding `PL` to `marketCodes`) makes both fail.
- [x] Local checks: `pnpm typecheck && pnpm test && pnpm build` pass; `@tazumo/address` 15 pass, 2 skipped.
- [ ] Current-head CI green and independent review recorded on the PR.
- [ ] Replace the local `checkDelivery` copy with the `@tazumo/merchant-ops` dependency once PR #76 merges (slice 2 or 3).
