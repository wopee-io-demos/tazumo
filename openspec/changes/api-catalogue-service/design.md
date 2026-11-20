# Design: read-only catalogue API service

## Shape
`apps/api` is the first module of the ADR-0005 modular monolith. Fastify plugins per domain (`routes/catalogue.ts`, `routes/health.ts`), a shared `pg` pool, and no ORM. Framework and migration choices are in ADR-0009.

## Data model
- `markets(code, country_code, currency, locale)`: ISO country and currency codes enforced by CHECK constraints.
- `catalogue_categories(code, name, sort_order)`.
- `merchants(id uuid, slug, market_code → markets, name, accepting_orders default false, delivery_eta_minutes null, synthetic default true)`.
- `products(id uuid, slug, merchant_id → merchants, category_code → catalogue_categories, name, description, price_minor integer ≥ 0, currency char(3), available, synthetic)`.

Merchant categories are derived from their products, not stored twice. Product currency is not yet constrained to the market currency at database level; the seed guarantees it and a trigger or composite key is a follow-up once merchants can be written through the API.

## Identifiers
Contract IDs remain UUIDs. Seeded IDs are UUIDv5 of `product:<fixture id>` / `merchant:<merchant slug>` under a fixed namespace, so they are identical on every machine and every reseed. The fixture IDs that tests and `contracts/sut.json` rely on (`pizza`, `bread`, ...) are returned as `slug`.

## Contract coupling
`src/contract.ts` loads `contracts/openapi.json`, registers every component schema with Fastify and builds each route's parameter and response schemas from the contract operation. The serializer therefore drops undeclared fields. Server-side validation is stricter than the contract only where the contract documents it (`marketCode` pattern). Tests validate every response with Ajv (JSON Schema 2020-12, as OpenAPI 3.1 requires) against the exact contract response schema, and fail when a `/v1` route is not declared.

## Security basics in this slice
- Request validation from the contract; parameterized SQL only; 16 KiB body limit.
- Server-generated request IDs (client `x-request-id` ignored, avoiding log injection), echoed in `ApiError.requestId`.
- Logs carry method, route template and status only: no URL query, no client IP, `authorization`/`cookie` redacted. Unhandled errors log the error class and SQLSTATE, never the message, and return a generic 500.
- `x-content-type-options: nosniff`. No CORS until a browser client consumes the API.
- `/health` runs `SELECT 1` and returns 503 when the database is unreachable.

## Authentication and authorization (design only, not implemented)
Discovery stays anonymous. Everything that touches a customer, merchant or order requires a bearer token.

- **Identity provider**: an external OIDC provider issues short-lived JWT access tokens (RS256/ES256, 5 to 15 minutes). The API validates signature against the provider JWKS (cached, with rotation), `iss`, `aud`, `exp`, `nbf` and clock skew of at most 60 s. No passwords are stored by Tazumo.
- **Principal**: `sub` maps to a `users` row created on first use. Roles live in the Tazumo database, not in token claims we cannot revoke: `customer`, `merchant_staff` (scoped to one or more merchant IDs), `courier` (scoped to assignments), `support` and `admin`.
- **Authorization**: a single policy module, called from route handlers, answers `can(principal, action, resource)`. Rules: customers read and create only their own orders; merchant staff read and transition orders for their merchants only; couriers see only assigned deliveries; support reads with an audit record; admin actions are audited. Ownership is checked in the SQL `WHERE` clause as well as in the policy so a missing check cannot leak rows. Unknown resources and forbidden resources both return 404 to customers to avoid enumeration; staff get 403.
- **Contract**: `BearerAuth` is already declared for order operations. 401 for missing or invalid tokens, 403/404 as above, `WWW-Authenticate` on 401.
- **Logging and privacy**: tokens never logged; `sub` logged as a salted hash; delivery addresses and names never logged (GDPR data minimization). Audit events are an append-only table, separate from application logs.
- **Abuse controls**: per-principal and per-IP rate limits on authenticated routes; idempotency keys scoped to the principal.
- **Testing**: integration tests mint tokens from a local test JWKS; negative tests for expired, wrong-audience, wrong-issuer, unsigned (`alg: none`) and cross-tenant access.
- **Open questions**: which OIDC provider (EU data residency), merchant staff invitation flow, and whether couriers authenticate through the same provider.

Tracked as a follow-up issue linked from #5.

## Running locally
```sh
docker run -d --name tazumo-a1-pg -e POSTGRES_USER=tazumo -e POSTGRES_PASSWORD=local -e POSTGRES_DB=tazumo -p 127.0.0.1:55433:5432 postgres:16-alpine
export DATABASE_URL=postgres://tazumo:local@127.0.0.1:55433/tazumo
pnpm --filter @tazumo/api db:migrate && pnpm --filter @tazumo/api db:seed
pnpm --filter @tazumo/api test
pnpm --filter @tazumo/api start   # http://127.0.0.1:3001
docker rm -f tazumo-a1-pg
```
