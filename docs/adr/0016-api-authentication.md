# ADR-0016: Bearer JWT verification with jose, database-held roles

Status: Proposed
Date: 2026-11-20
Tracking: issue #56 (from #5), OpenSpec `api-auth`, builds on ADR-0005 and ADR-0009

## Context

ADR-0005 requires authentication and owner/role authorization before any customer, merchant or order data is served. The design in OpenSpec `api-catalogue-service` sets the direction: an external OIDC provider issues short-lived JWT access tokens, Tazumo verifies them, and roles live in Tazumo's database. The provider itself is not chosen yet (EU data residency is open). The service must therefore depend only on standard OIDC artefacts: issuer, audience and a JWKS URL.

## Decision

### Token verification: `jose`

The API verifies `Authorization: Bearer` tokens with `jose` (`jwtVerify` with `createRemoteJWKSet`):

- **Algorithms:** an explicit allowlist of `RS256` and `ES256`. `none`, HMAC and any algorithm outside the list are rejected, even when the JWKS key omits `alg`.
- **Claims:** `iss` and `aud` must match the configuration. `exp` is required. `sub` must be a string of 1 to 255 characters. `nbf` is honoured. Clock tolerance is 60 s. `iat` is required. Tokens whose lifetime (`exp - iat`) exceeds `AUTH_MAX_TOKEN_LIFETIME` (default 3600 s, at most 86400 s) are rejected, as are tokens issued in the future. This caps lifetime even if the provider is misconfigured.
- **Token type:** optional `AUTH_TOKEN_TYPE` (for example `at+jwt`, RFC 9068) requires a matching `typ` header. `AUTH_AUDIENCE` must be the API's resource identifier, never an OIDC client ID. Otherwise ID tokens issued to that client would be accepted as access tokens.
- **JWKS:**
  - **Cache and rotation:** keys are cached for 10 minutes. An unknown `kid` triggers a refetch, at most once per 30 s cooldown, so rotation works without a restart and junk `kid`s cannot hammer the provider. The fetch timeout is 5 s.
  - **Provider outages:** if a refetch fails, the last successfully fetched key set (snapshotted on every fetch, so it includes the latest rotation) keeps verifying tokens for up to 24 h from that fetch. A key the provider removed just before an outage therefore stays trusted for that window; emergency revocation during an outage needs a restart or a lower stale limit. For 30 s after a failure, requests use that set without retrying, so callers do not each wait on the timeout. During an outage, unknown `kid`s still return 401.
- **Enforcement from the contract:** an `onRoute` hook attaches authentication to every route whose contract operation declares `BearerAuth`, including the automatic HEAD route. A new protected operation cannot be served anonymously by forgetting a hook, and a test checks every such route.
- **Failure mapping:** an invalid token returns 401 with `WWW-Authenticate: Bearer realm="tazumo", error="invalid_token"`, and a missing token returns 401 with a plain challenge. If the JWKS cannot be fetched or parsed, the response is 503, never a pass. If auth is not configured, protected routes return 503 (fail closed) and Discovery is unaffected.
- **Configuration:** `AUTH_JWKS_URL` must use https, except on loopback hosts.

Alternatives considered:

| Option | Why not |
| --- | --- |
| `@fastify/jwt` + `get-jwks` | Fastify-native decorators, but two packages (fast-jwt underneath) and JWKS rotation and cooldown semantics spread across them. `jose` is a single, dependency-free, widely audited library that covers JWKS caching and rotation itself. |
| `jsonwebtoken` + `jwks-rsa` | Callback-era API. Algorithm restrictions are opt-in, which is a history of algorithm-confusion bugs. RSA-centric JWKS client. |
| Provider SDK (Auth0, Cognito, Keycloak adapters) | Locks the API to a provider before the provider decision. |
| Opaque tokens with introspection | A network round-trip per request and a hard runtime dependency on the provider. JWT with a cached key set keeps the API available through provider outages of up to 24 h. |
| Sessions and cookies in the API | Native apps and web share one API; cookie CSRF handling and session storage add state we do not need. |

### Identity and roles in PostgreSQL

- `users` stores only `(issuer, subject)` and a creation time: no names, e-mails or addresses. The first authenticated call creates the row and grants `customer` in the same transaction. Concurrent first calls converge on one row.
- `user_roles` holds `customer`, `merchant_staff` (requires a `merchant_id`), `courier`, `support` and `admin`. Roles are never taken from token claims, so a grant can be revoked without waiting for token expiry. Until an admin API exists, grants other than `customer` are written in the database by operators.
- `audit_events` is append-only: triggers reject UPDATE, DELETE and TRUNCATE. Support and admin reads write an audit row before data is returned. If the audit write fails, the read fails.
  - **Least-privilege runtime role:** migration `0003` creates the NOLOGIN group role `tazumo_api`. It has:
    - SELECT on catalogue tables;
    - SELECT and INSERT on `users`;
    - SELECT, INSERT and DELETE on `user_roles`;
    - INSERT only on `audit_events`.
  - **Production deployment:** run the server as a login member of `tazumo_api`, and run migrations and seed as the schema owner. That role cannot update, delete, truncate or read the audit log, disable its triggers or drop it (all covered by tests). The owner still can, and the down migration drops the table, so owner credentials must stay out of the runtime.

### Authorization

A single pure module, `can(principal, action, resource)`, decides every protected read and returns either allow (with an audit flag) or deny with the status to use. Unknown resources return 404 for everyone. For resources that exist, forbidden reads return 403 to staff (`merchant_staff`, `support`, `admin`) and 404 to everyone else, couriers and customers included, so existence is not revealed. Route SQL repeats the ownership condition (`WHERE ... AND (privileged OR caller is staff of this merchant)`), so a missed policy call cannot leak rows.

### Logging

The `authorization` and `cookie` headers stay redacted (ADR-0009). A successful authentication logs a 16-hex HMAC-SHA-256 tag of `issuer` and `sub`, keyed by `AUTH_LOG_SALT`, so requests can be correlated without storing the subject in logs. `AUTH_LOG_SALT` (at least 32 characters) is required whenever auth is configured, so tags match across instances and restarts. Rejected tokens log only the jose error code. A key-source failure logs the error class.

## Consequences

- Any OIDC provider that publishes a JWKS and issues RS256 or ES256 access tokens with a configured audience works without code changes.
- Tokens stay valid until `exp` even if the provider revokes the session. Lifetimes are capped by `AUTH_MAX_TOKEN_LIFETIME` (default one hour); 5 to 15 minutes is the provider configuration target. Revoking a role takes effect on the next request.
- `audit_events` references `users` with `ON DELETE RESTRICT`. GDPR erasure must pseudonymize, not delete. A follow-up is needed before real users exist.
- Slice 2 (#56) added:
  - two-layer rate limits (per IP before verification, per principal after);
  - an admin role-grants API;
  - the `tazumo_api` runtime role.
- The provider choice is proposed in ADR-0017.
- Courier assignment scopes wait for orders.
