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
- **Claims:** `iss` and `aud` must match the configuration. `exp` and `sub` are required. `nbf` is honoured. Clock tolerance is 60 s.
- **JWKS:** cached for 10 minutes. An unknown `kid` triggers a refetch, at most once per 30 s cooldown, so rotation works without a restart and junk `kid`s cannot hammer the provider. The fetch timeout is 5 s.
- **Failure mapping:** an invalid token returns 401 with `WWW-Authenticate: Bearer realm="tazumo", error="invalid_token"`, and a missing token returns 401 with a plain challenge. If the JWKS cannot be fetched or parsed, the response is 503, never a pass. If auth is not configured, protected routes return 503 (fail closed) and Discovery is unaffected.
- **Configuration:** `AUTH_JWKS_URL` must use https, except on loopback hosts.

Alternatives considered:

| Option | Why not |
| --- | --- |
| `@fastify/jwt` + `get-jwks` | Fastify-native decorators, but two packages (fast-jwt underneath) and JWKS rotation and cooldown semantics spread across them. `jose` is a single, dependency-free, widely audited library that covers JWKS caching and rotation itself. |
| `jsonwebtoken` + `jwks-rsa` | Callback-era API. Algorithm restrictions are opt-in, which is a history of algorithm-confusion bugs. RSA-centric JWKS client. |
| Provider SDK (Auth0, Cognito, Keycloak adapters) | Locks the API to a provider before the provider decision. |
| Opaque tokens with introspection | A network round-trip per request and a hard runtime dependency on the provider. JWT plus JWKS caching keeps the API available during short provider blips for already-cached keys. |
| Sessions and cookies in the API | Native apps and web share one API; cookie CSRF handling and session storage add state we do not need. |

### Identity and roles in PostgreSQL

- `users` stores only `(issuer, subject)` and a creation time: no names, e-mails or addresses. The first authenticated call creates the row and grants `customer` in the same transaction. Concurrent first calls converge on one row.
- `user_roles` holds `customer`, `merchant_staff` (requires a `merchant_id`), `courier`, `support` and `admin`. Roles are never taken from token claims, so a grant can be revoked without waiting for token expiry. Until an admin API exists, grants other than `customer` are written in the database by operators.
- `audit_events` is append-only: triggers reject UPDATE, DELETE and TRUNCATE. Support and admin reads write an audit row before data is returned. If the audit write fails, the read fails.

### Authorization

A single pure module, `can(principal, action, resource)`, decides every protected read and returns either allow (with an audit flag) or deny with the status to use. Unknown resources return 404 for everyone. For resources that exist, forbidden reads return 404 to customers, so existence is not revealed, and 403 to staff. Route SQL repeats the ownership condition (`WHERE ... AND (privileged OR caller is staff of this merchant)`), so a missed policy call cannot leak rows.

### Logging

The `authorization` and `cookie` headers stay redacted (ADR-0009). A successful authentication logs a 16-hex HMAC-SHA-256 tag of `issuer` and `sub`, keyed by `AUTH_LOG_SALT`, so requests can be correlated without storing the subject in logs.

## Consequences

- Any OIDC provider that publishes a JWKS and issues RS256 or ES256 access tokens with a configured audience works without code changes.
- Tokens stay valid until `exp` even if the provider revokes the session. Short access-token lifetimes (5 to 15 minutes) are a provider configuration requirement. Revoking a role takes effect on the next request.
- `audit_events` references `users` with `ON DELETE RESTRICT`. GDPR erasure must pseudonymize, not delete. A follow-up is needed before real users exist.
- Not covered yet: rate limits, an admin API for grants, courier assignment scopes (which need orders), and the provider choice itself.
