# Design: API authentication and authorization (slice 1)

Decisions and alternatives are in ADR-0016. The target model is the "Authentication and authorization" section of `openspec/changes/api-catalogue-service/design.md`.

## Request flow
1. An `onRoute` hook in `app.ts` attaches `authenticate` as the first `onRequest` handler of every route whose contract operation declares `BearerAuth`. HEAD is treated as GET. Authentication therefore runs before schema validation, and unauthenticated callers learn nothing about parameter rules. Discovery operations declare no security, so they stay anonymous.
2. `authenticate` parses `Authorization: Bearer <jws>` and verifies it through `jose` (`src/auth/jwt.ts`). Verification failures map to 401 or 503 (`AuthError`).
3. `resolvePrincipal` (`src/auth/principals.ts`) upserts `users (issuer, subject)` and, only when the row is new, grants `customer` in the same transaction. It then loads the grants into `request.principal`.
4. The handler calls `can(principal, action, resource)` (`src/auth/policy.ts`). A deny becomes 403 or 404. An allow with `audit: true` writes `audit_events` before data is read.
5. The data query repeats the ownership condition.

## Data model (migration 0002)
- `users(id, issuer, subject, created_at)`, unique on `(issuer, subject)`.
- `user_roles(id, user_id → users ON DELETE CASCADE, role, merchant_id → merchants)`. A CHECK enforces that `merchant_id` is set exactly for `merchant_staff`. `UNIQUE NULLS NOT DISTINCT (user_id, role, merchant_id)` requires PostgreSQL 15 or later; CI and local runs use 16.
- `audit_events(id identity, occurred_at, actor_user_id → users ON DELETE RESTRICT, action, resource_type, resource_id, request_id)`. Triggers reject UPDATE, DELETE and TRUNCATE.

## Policy rules in this slice
| Action | Allowed | Audited | Denied |
| --- | --- | --- | --- |
| `user:read` | self; support, admin | support, admin (when not self) | merchant staff 403; customers and couriers 404 |
| `merchant_staff:list` | `merchant_staff` of that merchant; support, admin | support, admin | unknown merchant 404; other merchants' staff 403; customers and couriers 404 |

## Configuration
`AUTH_ISSUER`, `AUTH_AUDIENCE` and `AUTH_JWKS_URL` must be set together. The URL must use https unless the host is loopback. `AUTH_LOG_SALT` (32+ characters, required) keys the principal tag in logs. Optional `AUTH_TOKEN_TYPE` enforces `typ`. JWKS: 10 min cache, 30 s refetch cooldown, 5 s timeout. The last good key set is kept for up to 24 h through refetch failures, with no retry for 30 s after a failure. `iat` is required. Lifetime (`exp - iat`) is capped by `AUTH_MAX_TOKEN_LIFETIME` (default 3600 s). `sub` must be a string of 1 to 255 characters.

## Testing approach
`test/idp.ts` generates RS256, ES256 and RS384 key pairs with WebCrypto and serves a mutable JWKS from an in-process HTTP server on 127.0.0.1. Tests mint tokens with `jose.SignJWT`, and hand-craft `alg: none`, HS256 and tampered tokens. No real provider and no real credentials are involved.

## Slice 2

### Rate limits
Two fixed-window limiters (`src/rate-limit.ts`) are attached by the same contract-driven `onRoute` hook, in this order: per-IP limit, then `authenticate`, then per-principal limit.

| Layer | Key | Default | Purpose |
| --- | --- | --- | --- |
| IP | `request.ip`; IPv6 grouped by /64, IPv4-mapped addresses unwrapped | 300 requests / 60 s | Cuts off token floods and brute force before JWT verification and JWKS fetches |
| Principal | user ID | 120 requests / 60 s | Fair use per authenticated caller |

- **Over the limit:** 429 `rate_limited` with `Retry-After` (seconds until the window resets).
- **State and memory:** state is in memory per instance, bounded at 100k keys per layer.
  - Windows are kept in start order, and expired windows are swept from the front in amortised O(1).
  - If the table is still full of live windows, new keys share one overflow bucket allowed ten times the per-key limit. A live, possibly blocked key is never evicted.
  - **Known availability risk:** a flood of more than 100k distinct keys (IPv4 addresses or /64s) pushes new clients into the shared overflow bucket until windows expire. A shared store with larger capacity, or upstream DDoS protection, is the mitigation.
- **Fixed-window burst:** a fixed window can admit up to twice the limit across a window boundary. This is accepted for now; a sliding window is the upgrade path.
- **Multi-instance:** a deployment with several instances needs a shared store (for example PostgreSQL or Redis) before limits are global.
- **Proxies:** `TRUST_PROXY` configures Fastify's `trustProxy` as a comma-separated list of proxy IP addresses or CIDRs. Hop counts are rejected, because they would let direct clients pick their own key through `X-Forwarded-For`. It is off by default, so behind a proxy every client shares the proxy's bucket until it is set. Any value that is not an IP address falls into a single shared `unparseable` key.
- **Testing:** the limiter takes an injectable clock, so tests advance time without sleeping.

### Admin role grants
- **Endpoints:** `PUT` and `DELETE /v1/admin/users/{userId}/roles/{role}`.
  - `role` is `merchant_staff` (requires `?merchantId=`) or `support` (forbids it).
  - `admin` and `customer` are not grantable through the API.
- **Policy:** `role:manage` allows admins only and denies an admin acting on their own user ID (no self-escalation, no self-demotion). The denial is always 403, because the endpoints themselves are not secret.
- **Order of checks:**
  1. Policy, which runs before any lookup, so non-admins learn nothing.
  2. The `merchantId` rule (400).
  3. In one transaction: user exists (404), merchant exists (404), then the insert or delete with `ON CONFLICT DO NOTHING` / `RETURNING`.
  4. If a row changed, an audit event with `details: {role, merchantId}` is written in the same transaction.
- **Responses:** PUT returns 201 (created) or 200 (already present). DELETE returns 204 either way.
- **Canonical IDs and re-checks:**
  - UUID path and query values must match the canonical 8-4-4-4-12 hex pattern (the `urn:uuid:` form is rejected), and they are lower-cased before any check, query, audit or response.
  - Inside the transaction, the actor's admin grant is re-checked, and the canonical target ID is compared with the actor again.
  - Denied attempts are logged at warn level, with no audit row because nothing changed.

### Runtime database role
- Migration `0003` creates the NOLOGIN role `tazumo_api` if it is missing (roles are cluster-wide). It grants per schema:
  - USAGE on the schema;
  - SELECT on catalogue tables;
  - SELECT and INSERT on `users`;
  - SELECT, INSERT and DELETE on `user_roles`;
  - INSERT on `audit_events`.
- Operators create a login role `IN ROLE tazumo_api` for the server. Migrations and seed keep using the owner.
- Every future migration that adds a table must grant `tazumo_api` exactly what the runtime needs.
- Migration `0003` also enables row-level security on `user_roles`. `tazumo_api` may read all grants, insert only `customer`, `merchant_staff` and `support` grants, and delete only `merchant_staff` and `support` grants. The schema owner, used for migrations and the first admin, is not subject to these policies.
- A pre-existing `tazumo_api` role with LOGIN, SUPERUSER, BYPASSRLS, CREATEROLE, CREATEDB or REPLICATION, or with any role membership, aborts the migration. The migration needs CREATEROLE unless the role already exists. Use one cluster per environment, or restrict CONNECT per database.
- Migration `0003` also adds `audit_events.details jsonb`.

## Slice 3: GDPR erasure and export

- **Endpoints:**
  - `POST /v1/me/erasure`: self-service.
  - `POST /v1/admin/users/{userId}/erasure`: admin or support; others get 403.
  - `GET /v1/me/export`.
- **Erasure:** the app computes the pseudonym (HMAC with an HKDF-derived erasure key, length-prefixed input) and calls `erase_user(target, pseudonym, actor, initiator, request_id, recognition_window)`. This `SECURITY DEFINER` function does everything in one transaction:
  1. Locks the user row.
  2. If the user is already erased, returns the original `erased_at` (idempotent).
  3. Checks blockers: an `admin` grant, or a staff grant when support initiates. Either gives 409 with `details.blockers`.
  4. Re-tombstones any older record holding the same pseudonym with a random value.
  5. Sets `subject` to the pseudonym and records `erased_at`.
  6. Deletes all grants and inserts the audit row `user:erase` with `{initiator}`.
  7. Forgets keyed-hash tombstones older than the recognition window.
- **Supporting guarantees:**
  - A CHECK keeps `erased_at` and the `erased:` prefix consistent.
  - Tokens whose `sub` starts with `erased:` are rejected.
  - A `SECURITY DEFINER` trigger (`FOR SHARE` on the user row) refuses grants to erased users, even while an erasure is running. The admin API answers 409 `user_erased`.
- **Authentication after erasure:** `resolvePrincipal` checks the hashed subject both before and after its upsert, closing the race with a concurrent erasure. A token whose `iat` is at most `erased_at` + 60 s gets 401. Later tokens re-provision a new, unlinked user.
- **Export:**
  - one `REPEATABLE READ`, read-only transaction: identity, grants, and audit events from `export_audit_events(uuid)`, with whitelisted `details` (role, merchantId, initiator);
  - the runtime role can call this function for any ID; that limit is documented in ADR-0016;
  - logs (HMAC tag, request IDs) and the Art. 15(1) metadata (purposes, recipients, retention, source = identity provider) belong to the privacy notice, not this endpoint.
- **Privileges (migration `0004`):** no new table privileges for `tazumo_api`, only EXECUTE on `erase_user`, `export_audit_events` and `forget_erased_subjects`. The row-level security policies from `0003` are unchanged.
- **Issuer:** `users.issuer` stays in clear text. It is the identity provider's tenant URL, not personal data.
- **Provider side:** deleting the account at the identity provider stays an operator step until ADR-0017 is decided.
- **Integration points for other packages:** order and commerce data must add erasure blockers or pseudonymisation steps when they are wired into the API.

## Next slices
- Accept or amend ADR-0017 (OIDC provider), then run the Keycloak spike it proposes.
- Use a shared rate-limit store for multi-instance deployments.
- Define GDPR erasure by pseudonymizing `users` while keeping audit integrity.
- Add courier assignment scopes and order ownership once orders exist.
