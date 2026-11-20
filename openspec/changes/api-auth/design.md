# Design: API authentication and authorization (slice 1)

Decisions and alternatives are in ADR-0016. The target model is the "Authentication and authorization" section of `openspec/changes/api-catalogue-service/design.md`.

## Request flow
1. Routes opt in through `onRequest: authenticate`, so authentication runs before schema validation and unauthenticated callers learn nothing about parameter rules. Discovery routes do not register the hook.
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
| `user:read` | self; support, admin | support, admin (when not self) | customers 404, other staff 403 |
| `merchant_staff:list` | `merchant_staff` of that merchant; support, admin | support, admin | unknown merchant 404; customers 404; other staff 403 |

## Configuration
`AUTH_ISSUER`, `AUTH_AUDIENCE` and `AUTH_JWKS_URL` must be set together. The URL must use https unless the host is loopback. `AUTH_LOG_SALT` keys the principal tag in logs. JWKS cache: 10 min maximum age, 30 s refetch cooldown, 5 s timeout.

## Testing approach
`test/idp.ts` generates RS256, ES256 and RS384 key pairs with WebCrypto and serves a mutable JWKS from an in-process HTTP server on 127.0.0.1. Tests mint tokens with `jose.SignJWT`, and hand-craft `alg: none`, HS256 and tampered tokens. No real provider and no real credentials are involved.

## Next slices
- Choose the OIDC provider (ADR) and document its token lifetime settings.
- Add an admin API for role grants, with audit.
- Add per-principal and per-IP rate limits on authenticated routes.
- Define GDPR erasure by pseudonymizing `users` while keeping audit integrity.
- Add courier assignment scopes and order ownership once orders exist.
