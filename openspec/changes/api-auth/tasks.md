# Tasks

- [x] ADR-0016: `jose` JWT/JWKS verification versus `@fastify/jwt` + `get-jwks`, `jsonwebtoken` + `jwks-rsa`, provider SDKs, introspection and sessions; roles held in the database.
- [x] Bearer verification: RS256/ES256 allowlist, `iss`/`aud`/`exp`/`nbf`/`sub` checks, 60 s skew, cached JWKS with rotation and a cooldown, 401/503 mapping. Evidence: `test/auth.test.ts`, which covers the invalid-token table, rotation, cooldown, unavailable JWKS and missing config.
- [x] Migration `0002_identity-and-roles` (users, user_roles, append-only audit_events). Evidence: `test/migrations.test.ts` (apply, re-run, full down/up) and the audit append-only assertions.
- [x] First-use user creation with the `customer` grant, safe under concurrency. Evidence: the "concurrent first requests" test.
- [x] Policy module `can()` with SQL ownership repeated. Evidence: `test/policy.test.ts`, plus the HTTP cross-tenant test (404 customer, 403 staff, audited support read).
- [x] `GET /v1/me` and `GET /v1/merchants/{merchantId}/staff`, contract `0.3.0-draft`, with responses validated against the contract.
- [x] Discovery stays anonymous with or without a bad token; logs carry a keyed principal tag only.
- [x] Current-head CI green on PR #62 head fa8bacf: [API integration](https://github.com/wopee-io-demos/tazumo/actions/runs/44814348572) (64/64), [Quality checks](https://github.com/wopee-io-demos/tazumo/actions/runs/44814348549), [Dependency audit](https://github.com/wopee-io-demos/tazumo/actions/runs/44814348548).
- [x] Independent review on ea19bda: no blockers. All five should-fix items and most nits fixed: `sub` validation, contract-driven auth (with HEAD), last-good JWKS through outages, `typ` option, whole-suite log leak check, courier disclosure, SQL ownership test, rollback safety, case-insensitive scheme, required log salt, 1 h lifetime cap, `down all`. Evidence: 60/60 tests, plus mutation checks for the fallback and the HEAD route.
- [x] Re-review on 38388dc: no blockers. Fixed: the outage test no longer depends on timing, the lifetime cap uses `exp - iat` (configurable through `AUTH_MAX_TOKEN_LIFETIME`), the fallback snapshot is taken on every fetch, revocation during an outage is documented, and every route is now either in the contract or on the `/health` allowlist. Left open by choice: a least-privilege DB role for the audit table (production gate), the error response descriptions, `docs/adr/README.md` (outside owned paths) and a CI smoke run with auth configured.
- [x] Merged as 4e0dd00d358773f17b02c9f354320c43bbe8afec; recorded on #56 and #5.

Not implemented: provider choice, rate limits, admin grants API, courier scopes, payments, orders.
