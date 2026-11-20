# Tasks

- [x] ADR-0009: framework (Fastify vs Hono vs NestJS, plus alternatives) and migration tool (node-pg-migrate SQL).
- [x] Migration `0001_catalogue-foundation` for markets, categories, merchants, products; money as integer minor units + ISO currency. Evidence: `test/migrations.test.ts` (apply, re-run no-op, down/up, constraint rejections) on local PostgreSQL 16.
- [x] Idempotent seed from `@tazumo/core` fixtures, preserving fixture IDs as slugs with deterministic UUIDv5 IDs. Evidence: `test/fixtures.test.ts`, seed idempotency test.
- [x] `GET /v1/markets`, `GET /v1/merchants`, `GET /v1/merchants/{merchantId}/products` with contract-driven schemas; responses validated with Ajv 2020 against `contracts/openapi.json`. Evidence: `test/catalogue.test.ts`.
- [x] Contract `0.2.0-draft`: additive `slug`, `category`, `synthetic`; 400 on products route. `node scripts/validate-openapi.mjs` passes.
- [x] Security basics: input validation, generic 500s, log redaction (no query, IP, credentials), `/health` 200/503. Evidence: `test/security.test.ts`.
- [x] `.github/workflows/api.yml`: `services: postgres`, same `runs-on` expression as `ci.yml`, tests plus migrate/seed/smoke of the running server.
- [x] Auth/authorization design written in design.md (not implemented); follow-up issue #56.
- [x] Current-head CI green on PR #49 head adb43b4: [API integration](https://github.com/wopee-io-demos/tazumo/actions/runs/44809547364) (24/24 tests, migrate/seed/smoke/rollback), [Quality checks](https://github.com/wopee-io-demos/tazumo/actions/runs/44809547440), [Dependency audit](https://github.com/wopee-io-demos/tazumo/actions/runs/44809547490).
- [x] Independent review (reviewed 13b6245): blocker (invalid api.yml env context) and should-fix items fixed in a1147b6; API integration run 44808810011 green on a1147b6 (24/24 tests, migrate/seed/smoke/rollback).
- [x] Re-review on 3176567: no blockers or should-fix left; nits fixed in be2ec1b. Recorded in PR #49.
- [x] Merged as 9aef96d0daa2557a3bf4ebae98d5bedf8e5f070b; recorded on issue #5.

Not implemented and not claimed: authentication, quotes, orders, payments, courier dispatch or tracking, deployment.
