# Tasks

- [x] ADR-0016: `jose` JWT/JWKS verification versus `@fastify/jwt` + `get-jwks`, `jsonwebtoken` + `jwks-rsa`, provider SDKs, introspection and sessions; roles held in the database.
- [x] Bearer verification: RS256/ES256 allowlist, `iss`/`aud`/`exp`/`nbf`/`sub` checks, 60 s skew, cached JWKS with rotation and a cooldown, 401/503 mapping. Evidence: `test/auth.test.ts`, which covers the invalid-token table, rotation, cooldown, unavailable JWKS and missing config.
- [x] Migration `0002_identity-and-roles` (users, user_roles, append-only audit_events). Evidence: `test/migrations.test.ts` (apply, re-run, full down/up) and the audit append-only assertions.
- [x] First-use user creation with the `customer` grant, safe under concurrency. Evidence: the "concurrent first requests" test.
- [x] Policy module `can()` with SQL ownership repeated. Evidence: `test/policy.test.ts`, plus the HTTP cross-tenant test (404 customer, 403 staff, audited support read).
- [x] `GET /v1/me` and `GET /v1/merchants/{merchantId}/staff`, contract `0.3.0-draft`, with responses validated against the contract.
- [x] Discovery stays anonymous with or without a bad token; logs carry a keyed principal tag only.
- [ ] Current-head CI green (record run URLs).
- [x] Independent review on ea19bda: no blockers. All five should-fix items and most nits fixed: `sub` validation, contract-driven auth (with HEAD), last-good JWKS through outages, `typ` option, whole-suite log leak check, courier disclosure, SQL ownership test, rollback safety, case-insensitive scheme, required log salt, 1 h lifetime cap, `down all`. Evidence: 60/60 tests, plus mutation checks for the fallback and the HEAD route.
- [ ] Merge and record the merge SHA on #56 and #5.

Not implemented: provider choice, rate limits, admin grants API, courier scopes, payments, orders.
