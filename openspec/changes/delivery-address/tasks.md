# Tasks

## Slice 1 (ADR and `@tazumo/address`)

- [x] ADR-0023 (Proposed): geocoding provider comparison with a recommendation (self-hosted Nominatim on an EU host; HERE as the no-ops fallback); the decision is left to the owner because it needs a host or an account.
- [x] `validateAddress` / `normalizeAddress` for SK, CZ, DE, AT. Evidence: `src/address.test.ts` (valid per market with diacritics, idempotent normalization, wrong postal format per market, unsupported country, market mismatch, missing/blank city and line 1, over-length fields, unknown fields, wrong types, control and invisible format characters).
- [x] `Geocoder` port (`found` / `not_found` / `unavailable`), `FixtureGeocoder` in `@tazumo/address/testing` with one synthetic zone per market, `resolveAddressDelivery`. Evidence: `src/geocoder.test.ts` (stable points, one SK fixture inside and one outside the synthetic zone, `not_found` for near-miss and real-looking addresses, invalid input never reaches the geocoder, `unavailable` passes through, returned points are copies).
- [x] `redactAddress`. Evidence: `src/redact.test.ts`, a seeded property test over 2,000 generated addresses asserting the output equals the redaction of country and postal code alone (a mutant that leaks house-number digits fails it).
- [x] Drift tests in `src/drift.test.ts`: contract `DeliveryAddress` fields, required set and `maxLength` (the four fields the contract leaves unbounded are pinned; #122 adds their limits to the contract); `checkDelivery` against `@tazumo/merchant-ops`; `addressMarkets` against `@tazumo/commerce` `marketCodes`. The commerce test runs on main since PR #80 merged (f9616f7); the merchant-ops test skips until PR #76 is on main. Evidence: run locally against the PR heads' sources (3/3 pass), and a mutation (removing zone validation, adding `PL` to `marketCodes`) makes both fail.
- [x] Local checks: `pnpm typecheck && pnpm test && pnpm build` pass; `@tazumo/address` 17 pass, 1 skipped.
- [x] Independent review: 8737db1 (no blockers, 5 should-fix, nits) and re-review 792d52b (no blockers, 3 nits); all fixed except the ADR index entry, which is in #122.
- [ ] Current-head CI green on the final head.
- [ ] Replace the local `checkDelivery` copy with the `@tazumo/merchant-ops` dependency once PR #76 merges (slice 2 or 3).

## Slice 2 (Nominatim adapter and infrastructure, after the owner accepted ADR-0023 on 2026-11-21)

- [x] ADR-0023 set to Accepted (decided by the repository owner, 2026-11-21); index entry added to `docs/adr/README.md`.
- [x] `NominatimGeocoder`. Evidence: `src/nominatim.test.ts` replays responses recorded from a local Nominatim 5.3.3 (Bremen extract) through a loopback HTTP server: found per precision, exact query parameters and User-Agent, not_found for empty/coarse/other-country/unsupported-country (no request sent), unavailable for 5xx, 429, 400, HTML, broken JSON, object body, bad or numeric coordinates, oversized body, a redirect to a working endpoint (a mutant with `redirect: 'follow'` fails), no response, a body that stalls after the headers (reason `timeout`), connection reset and refused port; log entries carry only redacted data and a throwing sink is ignored; invalid configuration, including any openstreetmap.org host, rejected. 12 parallel runs: no failures.
- [x] `infra/geocoding/`: digest-pinned compose file (`address` style, `FREEZE`, no flatnode, loopback bind, capped logs, PostgreSQL statement logging off), `prepare-extract.sh` (Geofabrik download, MD5 check, region validation, `KEEP_EXISTING`, pinned `osmium-tool` merge), sizing, update cadence and privacy notes. Evidence: local import 5.6 min, 303 MB frozen DB, `log_min_error_statement = panic`.
- [x] Live integration check `integration/nominatim.test.ts` (skips without `NOMINATIM_URL`). Evidence: 2/2 pass against the local Bremen import (before and after the `FREEZE` change); container logs and `/var/log` contain none of the queried streets, also after a malformed query. CI job `.github/workflows/geocoding-integration.yml` runs the same import and tests on GitHub-hosted Ubuntu (PRs touching the package or infra, weekly).
- [x] Infrastructure issue #146 (status:blocked, owner action): sizing, Hetzner AX41 option, monthly blue/green re-import, cost estimate.
- [ ] Current-head CI green on the PR, including the geocoding integration job.
