# ADR-0009: Fastify HTTP service and node-pg-migrate SQL migrations

Status: Proposed
Date: 2026-11-20
Tracking: issue #5, OpenSpec `api-catalogue-service`, builds on ADR-0005

## Context

ADR-0005 proposes a contract-first modular monolith on PostgreSQL and leaves the TypeScript HTTP framework open (Fastify, NestJS or Hono). The first backend slice serves the read-only Discovery operations from `contracts/openapi.json`. It also needs versioned schema migrations.

Repository constraints that shape the choice:

- The monorepo runs TypeScript directly with Node 22 type stripping (`node --experimental-strip-types`) and has no build step for shared packages. `@tazumo/core` exports `.ts` sources.
- The OpenAPI 3.1 contract is the boundary. Its schemas are JSON Schema, so a framework that validates and serializes with JSON Schema can use them without duplication.
- ADR-0005 requires money as integer minor units plus ISO currency and no PII in logs.

## Decision

### HTTP framework: Fastify 5

| Criterion | Fastify | Hono | NestJS |
| --- | --- | --- | --- |
| Runs under Node type stripping, no build | Yes | Yes | No. Decorators and `emitDecoratorMetadata` need a compiler (tsc or SWC) |
| Uses contract JSON Schema directly | Built in: Ajv request validation and schema-driven response serialization | Needs a validator middleware (Zod or Valibot, or an OpenAPI adapter); contract schemas would be translated or duplicated | Class-validator DTOs or a Swagger module; contract duplicated as classes |
| Logging and redaction | pino built in, with redaction paths and serializers | Bring your own | Built-in logger is basic; pino through an adapter |
| Modular monolith fit | Encapsulated plugins per domain | Sub-apps per domain | Strong modules and DI, with the most ceremony |
| Runtime reach | Node | Node, Bun, Deno, edge workers | Node |
| Maturity for Node services | High, widely used | Growing, edge-first | High, large ecosystem |

We use **Fastify**. Routes take their response and parameter schemas from `contracts/openapi.json` at startup (`apps/api/src/contract.ts`), so the serializer drops any field the contract does not declare and requests are validated against the declared parameters. Each domain is a Fastify plugin (`routes/catalogue.ts`, `routes/health.ts`), which keeps the module boundaries from ADR-0005.

Alternatives considered:

- **Hono**: small and fast, with the best multi-runtime story. We do not need edge deployment yet, and contract-driven validation would mean another schema layer.
- **NestJS**: good structure for large teams, but it does not run under the repo's type-stripping setup without a compiler, and its DTO classes would duplicate the OpenAPI contract.
- **Express 5**: familiar, but validation, serialization and structured logging are all add-ons.
- **Generated server from OpenAPI** (openapi-backend and similar): strong contract coupling but immature for OpenAPI 3.1 in TypeScript. Revisit when typed clients are generated (ADR-0005 gate).

### Migration tool: node-pg-migrate 9 with plain SQL files

Migrations live in `apps/api/migrations/NNNN_name.sql` with `-- Up Migration` / `-- Down Migration` sections. They run in a single transaction under a PostgreSQL advisory lock and are recorded in `schema_migrations`. Order is checked. The same runner is used by the CLI (`pnpm --filter @tazumo/api db:migrate`) and by the integration tests, which migrate a throwaway schema per test.

Alternatives considered:

- **Prisma Migrate / Drizzle Kit**: generate SQL from an ORM schema. Both bring an ORM we do not need for parameterized queries, and diffs are generated rather than reviewed as written.
- **Knex migrations**: JavaScript migration files and a query builder we would not otherwise use.
- **Flyway, dbmate, Sqitch**: solid SQL-first tools, but they add a JVM or Go binary to CI and to developer machines.
- **Hand-written runner**: fewest dependencies, but locking, ordering checks and down migrations would need to be rebuilt and maintained.

### Database access

`pg` (node-postgres) with parameterized queries only, a pool with `statement_timeout` and `application_name`. No ORM for now.

## Consequences

- The API runs with `node --experimental-strip-types`; no build output. Source must stay erasable TypeScript (`erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or decorators.
- Contract and implementation cannot drift silently: an undeclared field is not serialized, and a test fails when a `/v1` route is missing from the contract or a response does not validate against it.
- `/health` is operational and unversioned, so it stays outside the public contract (`scripts/validate-openapi.mjs` requires `/v1/` paths).
- No lockfile is committed in this repository, so dependency versions for the API are pinned exactly in `apps/api/package.json`.
- This ADR does not approve a production deployment. Auth, secret management, least-privilege database roles, rate limiting and observability remain gates under ADR-0005.
