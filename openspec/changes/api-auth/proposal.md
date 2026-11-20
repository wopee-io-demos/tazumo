# API authentication and authorization (slice 1)

## Why
Issue #56, from #5. Customer, merchant and order data must not be served without verified identity and owner/role authorization (ADR-0005). This slice builds the identity foundation and proves it end to end, before orders exist.

## What changes
- Bearer JWT verification against a cached remote JWKS, with rotation, an algorithm allowlist and claim checks (ADR-0016).
- Migration `0002_identity-and-roles`: `users` (issuer + subject only), `user_roles`, append-only `audit_events`.
- `can(principal, action, resource)` policy module, with ownership repeated in SQL.
- `GET /v1/me` and `GET /v1/merchants/{merchantId}/staff` (contract `0.3.0-draft`, additive). The staff route is the tenant-scoped resource that proves cross-tenant denial.
- Integration tests use locally generated keys and an in-process JWKS server.

## Out of scope
OIDC provider choice, rate limits, an admin API for role grants, courier assignment scopes, payments, orders and courier tracking. Discovery endpoints stay anonymous.

## Tracking
Issue #56, epic #5, ADR-0016.
