# @tazumo/api

Catalogue API over PostgreSQL with bearer-token identity. Serves synthetic fixture data from `@tazumo/core`; not deployed, no orders or payments. Decisions: [ADR-0005](../../docs/adr/0005-modular-marketplace-backend.md), [ADR-0009](../../docs/adr/0009-api-framework-and-migrations.md), [ADR-0016](../../docs/adr/0016-api-authentication.md). Spec and local setup: [OpenSpec `api-catalogue-service`](../../openspec/changes/api-catalogue-service/design.md).

| Script | Purpose |
| --- | --- |
| `db:migrate` / `db:rollback` | Apply all / revert the last SQL migration in `migrations/` (`node --experimental-strip-types src/migrate.ts down all` reverts every migration) |
| `db:seed` | Idempotently load the synthetic fixtures |
| `start` | Serve on `HOST:PORT` (default `127.0.0.1:3001`) |
| `test` | Integration tests; needs `DATABASE_URL` for a disposable database |

Environment: `DATABASE_URL` (required), `HOST`, `PORT`, `LOG_LEVEL`, `TAZUMO_COMMIT` (the deployed commit's full SHA, reported by `/health` with the product version; `unknown` when unset).

Auth (all three or none; without them `/v1/me` and other protected routes return 503): `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` (https, or http on loopback only). `AUTH_LOG_SALT` (32+ characters) is required with them and keys the hashed principal tag in logs. Optional `AUTH_TOKEN_TYPE` (for example `at+jwt`) enforces the token `typ`, and `AUTH_MAX_TOKEN_LIFETIME` (seconds, default 3600) caps `exp - iat`. `AUTH_AUDIENCE` must be the API resource identifier, never an OIDC client ID. Admins grant and revoke `merchant_staff` and `support` with `PUT`/`DELETE /v1/admin/users/{userId}/roles/{role}`. The first admin is granted in the database.

Every route declares a rate-limit tier in its route config. Startup fails without one.

- **Anonymous discovery routes:** limited per client IP (300 requests per 60 s).
- **`/health`:** its own per-IP budget (1,200 requests per 60 s), so probes keep working while discovery traffic is limited.
- **Authenticated routes:** limited per IP (300 requests per 60 s, before token verification) and per principal (120 requests per 60 s). Over the limit, requests get 429 with `Retry-After`. Unmatched paths count against the public limit.

These limits apply to every tier:

- **Per instance:** each instance keeps its own counters.
- **Behind a reverse proxy:** set `TRUST_PROXY` to a comma-separated list of proxy IP addresses or CIDRs. Otherwise all clients share the proxy's bucket.
- **Deploy probes:** point them at the instance directly, not through the proxy, so probe traffic is not counted together with client traffic.

Quotes: `POST /v1/order-quotes` prices a basket with `@tazumo/commerce` rules for the market's country (SK, CZ, DE, AT), using server-side prices and product VAT categories.

- The seeded IE demo market has no rules and returns 422 `unsupported_market`.
- Fees and the distance (derived from the postal code) are synthetic. VAT rates are research data to re-verify.
- `total` is exact. `payable` differs from it only for cash payments in CZK.
- Quotes are not stored yet.

GDPR: `POST /v1/me/erasure` (self-service) and `POST /v1/admin/users/{userId}/erasure` (admin or support) pseudonymise the user, delete their grants and audit the erasure. Tokens issued before the erasure are rejected afterwards. `GET /v1/me/export` returns the caller's data. Deleting the account at the identity provider is a separate operator step until a provider is wired in. Erasure recognition depends on `AUTH_LOG_SALT`, so rotate it deliberately. Schedule `pnpm db:forget-erased` daily with owner credentials; it replaces keyed-hash tombstones older than 24 h 2 min with random ones.

In production, run the server as a login role that is a member of `tazumo_api` (created by migration `0003`, with append-only access to `audit_events`), and run `db:migrate`/`db:seed` as the schema owner. The owner needs CREATEROLE unless `tazumo_api` already exists. Use one PostgreSQL cluster per environment, because roles are cluster-wide.

```sql
CREATE ROLE tazumo_api_app LOGIN PASSWORD '...' IN ROLE tazumo_api;
```

Design: [OpenSpec `api-auth`](../../openspec/changes/api-auth/design.md).

## Local identity provider

The development Keycloak realm in [`infra/idp`](../../infra/idp/README.md) (ADR-0017) issues tokens this API accepts. Start it with `bash infra/idp/up.sh`, then run the server with:

| Variable | Value for the `tazumo` realm |
| --- | --- |
| `AUTH_ISSUER` | `http://127.0.0.1:48180/realms/tazumo` (Keycloak's `KC_HOSTNAME` fixes it, whatever host the browser used) |
| `AUTH_AUDIENCE` | `tazumo-api` (added by an audience mapper on the app clients; not a client ID) |
| `AUTH_JWKS_URL` | `http://127.0.0.1:48180/realms/tazumo/protocol/openid-connect/certs` (http is accepted because the host is loopback) |
| `AUTH_TOKEN_TYPE` | `at+jwt` (the realm's clients issue RFC 9068 access tokens) |
| `AUTH_MAX_TOKEN_LIFETIME` | optional; the realm's access tokens live 300 s, below the 3600 s default cap |
| `AUTH_LOG_SALT` | any random value of 32+ characters, for example `openssl rand -hex 24` |

Users sign up, sign in and reset passwords only on Keycloak's pages. No API route accepts a password, and `tests/idp/no-password-fields.test.mts` keeps it that way. `.github/workflows/idp.yml` runs this API against the real realm.
