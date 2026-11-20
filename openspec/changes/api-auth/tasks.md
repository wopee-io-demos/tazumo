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


## Slice 2 (rate limits, admin grants, runtime role, provider ADR)

- [x] Two-layer rate limits (IP before verification, principal after), 429 with `Retry-After`. Evidence: `test/rate-limit.test.ts` with a simulated clock: reset after the window, keys isolated, flood stopped before any JWKS fetch, discovery unaffected.
- [x] Admin role-grants API: idempotent, audited in the same transaction, admin only, no self-changes. Evidence: `test/admin.test.ts` (201/200/204, single audit rows, 403 for customer/staff/support and self-escalation, 404 unknown user or merchant, 400 for invalid roles or `merchantId`) and `test/policy.test.ts`.
- [x] Migration `0003`: `tazumo_api` least-privilege role and `audit_events.details`. Evidence: the admin suite runs the whole API as a login member of `tazumo_api`; UPDATE/DELETE/TRUNCATE/SELECT on the audit log, catalogue writes, DISABLE TRIGGER and DROP are refused.
- [x] ADR-0017 (Proposed): OIDC provider comparison with a recommendation; the decision is left to the owner.
- [x] Contract `0.4.0-draft`: admin operations and 429 responses.
- [x] Independent review on 57cc9ff. Every item fixed:
  - Blocker: upper-case UUIDs bypassed the admin self-change check. IDs are now canonicalised and the target is re-checked inside the transaction.
  - `urn:uuid:` IDs caused a 500; they are now rejected with 400.
  - Limiter eviction can no longer free a blocked key: windows are kept in start order and a full table fails closed.
  - IPv6 addresses are keyed by /64, and `TRUST_PROXY` is configurable.
  - An existing `tazumo_api` role with unsafe attributes is refused, and the CREATEROLE and per-cluster preconditions are documented.
  - ADR-0017 corrected: hyperscaler exposure, `at+jwt` row, pseudonymisation wording.
  - Nits: row-level security on admin grants, admin re-check in the transaction, deny logging, concurrency test, a meaningful flood/JWKS test, independent admin tests, guarded down migration, 429 on every BearerAuth operation.
- [x] Re-review on 813e289: 17 of 23 findings resolved. Then fixed:
  - Hop-count `TRUST_PROXY` (direct clients could choose their own key) is replaced by an IP/CIDR list only, and non-IP values share one key.
  - A full limiter table now sends new keys to an overflow bucket (10x the limit) instead of locking everyone out; the remaining risk is documented.
  - The `tazumo_api` safety check also covers REPLICATION and role memberships.
  - Row-level security allows inserting only `customer`, `merchant_staff` and `support`.
  - UUID `pattern` added to the contract parameters.
  - In-transaction denials are logged.
  - ADR-0017 re-identification wording corrected.
- [x] Current-head CI green on PR #66 head c1c5f69: [API integration](https://github.com/wopee-io-demos/tazumo/actions/runs/44818849484) (81/81), [Quality checks](https://github.com/wopee-io-demos/tazumo/actions/runs/44818849402), [Dependency audit](https://github.com/wopee-io-demos/tazumo/actions/runs/44818849429), [Test evidence](https://github.com/wopee-io-demos/tazumo/actions/runs/44818849465).
- [x] Merged as 3f95fbd02ad09e1526252e931dd8eb5b2104ac08; recorded on #56.


## Slice 3 (GDPR erasure and export)

- [x] Self-service and admin/support erasure in one transaction: keyed-hash subject, grants deleted, audit event without personal data. Idempotent, blocked by an `admin` grant. Evidence: `test/privacy.test.ts`, which runs as `tazumo_api`.
- [x] Tokens issued before the erasure are rejected; later tokens re-provision an unlinked customer. Evidence: same suite, using a deterministic `iat` with no sleeps.
- [x] `GET /v1/me/export` through a `SECURITY DEFINER` audit function; it returns only the caller's data.
- [x] Negative tests: customer and staff get 403, double erasure has no new effect, old tokens get 401, an admin target gets 409, unknown user 404, malformed ID 400, `erased:` subjects are rejected, and no erased subject remains in `users` or `audit_events`.
- [x] Mutation checks: removing the erased-token check, the blockers, or the policy denial each makes a test fail.
- [x] Migration `0004` and contract `0.5.0-draft`; ADR-0017 erasure section updated.
- [x] Independent review on 4b268bc. 2 blockers and 9 should-fix findings, all resolved:
  - Blocker: the column UPDATE grant allowed taking over an admin and un-erasing. Replaced by the `SECURITY DEFINER` `erase_user`; the runtime has no UPDATE on `users`.
  - Blocker: a second erasure of the same subject collided. The older tombstone is now re-tombstoned at random.
  - Should-fix:
    - the `resolvePrincipal` race is closed by a re-check after the upsert;
    - grants to erased users are refused (trigger plus 409);
    - support can no longer erase staff (`staff_grant` blocker);
    - the clock tolerance is applied after erasure;
    - token tests derive `iat` from `erasedAt`;
    - the export function's limits are documented;
    - recognition uses its own HKDF key and expires after the token-lifetime window;
    - the export includes whitelisted details;
    - ADR-0016 was corrected.
  - Nits: `logSalt` is required, HMAC domain separation, a consistent export snapshot, a re-authentication note in ADR-0017.
- [x] Re-review on 75b9346: no blockers. Then fixed:
  - The existing-user race returned 500; it now returns 401.
  - The recognition window was a caller parameter, which allowed premature forgetting. It is now fixed in the function, EXECUTE is revoked from the runtime, and an owner-run `db:forget-erased` script exists.
  - `erase_user` checks that the actor holds the initiator role.
  - The export releases its connection on errors.
  - ADR-0016 states the remaining limits honestly.
- [x] Third check on ac89634: all six items resolved. Its three nits are fixed: the export builds its result before releasing the connection, a revoked-initiator race now returns 403, and the ADR-0016 lead-in is corrected.
- [ ] Current-head CI green (record run URLs).
- [ ] Merge and record the merge SHA on #56.

Not implemented: provider wiring (pending ADR-0017), a shared rate-limit store, courier scopes, payments, orders.
