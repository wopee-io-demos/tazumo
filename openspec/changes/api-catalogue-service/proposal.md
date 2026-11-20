# Read-only catalogue API service

## Why
Clients render the synthetic `@tazumo/core` fixtures directly. ADR-0005 needs a real backend slice behind `contracts/openapi.json` before quotes, auth or orders can follow. This change delivers the first one: PostgreSQL-backed, read-only Discovery endpoints.

## What changes
- New `apps/api` (`@tazumo/api`): Fastify service, `pg` pool, node-pg-migrate SQL migrations (ADR-0009).
- Schema for markets, catalogue categories, merchants and products. Money is stored as integer minor units plus ISO 4217 currency.
- Idempotent seed from the synthetic `@tazumo/core` fixtures. Fixture product IDs (`pizza`, ...) are kept as `slug`s and determine stable UUIDv5 `id`s.
- `GET /v1/markets`, `GET /v1/merchants?marketCode=`, `GET /v1/merchants/{merchantId}/products`, plus unversioned `GET /health`.
- Contract `0.2.0-draft` (additive): optional `slug`, `category` and `synthetic` fields, and a declared 400 on the products route.
- Integration tests against real PostgreSQL; new `.github/workflows/api.yml` with a `services: postgres` job.

## Out of scope
Authentication (designed in design.md, not implemented), quotes, orders, payments/PSP, courier dispatch or tracking, deployment. Merchants stay synthetic, never accept orders and carry no ETA.

## Tracking
Issue #5, ADR-0005, ADR-0009.
