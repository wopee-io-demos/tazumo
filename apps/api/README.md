# @tazumo/api

Catalogue API over PostgreSQL with bearer-token identity. Serves synthetic fixture data from `@tazumo/core`; not deployed, no orders or payments. Decisions: [ADR-0005](../../docs/adr/0005-modular-marketplace-backend.md), [ADR-0009](../../docs/adr/0009-api-framework-and-migrations.md), [ADR-0016](../../docs/adr/0016-api-authentication.md). Spec and local setup: [OpenSpec `api-catalogue-service`](../../openspec/changes/api-catalogue-service/design.md).

| Script | Purpose |
| --- | --- |
| `db:migrate` / `db:rollback` | Apply all / revert the last SQL migration in `migrations/` (`node --experimental-strip-types src/migrate.ts down all` reverts every migration) |
| `db:seed` | Idempotently load the synthetic fixtures |
| `start` | Serve on `HOST:PORT` (default `127.0.0.1:3001`) |
| `test` | Integration tests; needs `DATABASE_URL` for a disposable database |

Environment: `DATABASE_URL` (required), `HOST`, `PORT`, `LOG_LEVEL`.

Auth (all three or none; without them `/v1/me` and other protected routes return 503): `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` (https, or http on loopback only). `AUTH_LOG_SALT` (32+ characters) is required with them and keys the hashed principal tag in logs. Optional `AUTH_TOKEN_TYPE` (for example `at+jwt`) enforces the token `typ`. `AUTH_AUDIENCE` must be the API resource identifier, never an OIDC client ID. Roles other than `customer` are granted in the database (`user_roles`) until an admin API exists. Design: [OpenSpec `api-auth`](../../openspec/changes/api-auth/design.md).
