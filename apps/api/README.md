# @tazumo/api

Read-only catalogue API over PostgreSQL. Serves synthetic fixture data from `@tazumo/core`; not deployed, no auth, orders or payments. Decisions: [ADR-0005](../../docs/adr/0005-modular-marketplace-backend.md), [ADR-0009](../../docs/adr/0009-api-framework-and-migrations.md). Spec and local setup: [OpenSpec `api-catalogue-service`](../../openspec/changes/api-catalogue-service/design.md).

| Script | Purpose |
| --- | --- |
| `db:migrate` / `db:rollback` | Apply all / revert the last SQL migration in `migrations/` |
| `db:seed` | Idempotently load the synthetic fixtures |
| `start` | Serve on `HOST:PORT` (default `127.0.0.1:3001`) |
| `test` | Integration tests; needs `DATABASE_URL` for a disposable database |

Environment: `DATABASE_URL` (required), `HOST`, `PORT`, `LOG_LEVEL`.
