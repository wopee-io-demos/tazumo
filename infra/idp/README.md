# Development identity provider (Keycloak)

Local and CI identity provider for [ADR-0017](../../docs/adr/0017-oidc-provider-eu-residency.md): Keycloak, Mailpit as the mail catcher, and PostgreSQL for Keycloak's own data. **Development only.** This is not the production deployment (hosting, backups and on-call are ADR-0017 consequence 2).

```bash
bash infra/idp/up.sh                                     # start, wait until healthy, seed test users
docker compose -f infra/idp/compose.yml down -v          # stop and delete all data
```

| | URL (loopback only) |
| --- | --- |
| Keycloak realm (issuer) | `http://127.0.0.1:48180/realms/tazumo` |
| Keycloak admin console | `http://127.0.0.1:48180/admin/` |
| Mailpit (captured e-mail) | `http://127.0.0.1:48125` |

Set `IDP_PORT`, `IDP_MAIL_PORT` or `IDP_PROJECT` (container name prefix) to change the defaults. Every port binds to 127.0.0.1.

`--import-realm` skips a realm that already exists, so after editing `realm.json` run `down -v` and `up.sh` again. Run `down -v` too before deleting `.env`, because the PostgreSQL volume keeps the old password.

## Credentials

Nothing secret is committed. On first run `up.sh` writes `infra/idp/.env` (gitignored, mode 0600) with a random PostgreSQL password and a random password for the `dev-only-admin` bootstrap admin. The admin is reachable only on loopback.

`seed-users.mjs` creates `dev-customer@tazumo.test`, `dev-merchant-staff@tazumo.test`, `dev-support@tazumo.test` and `dev-admin@tazumo.test` with e-mail already verified, and gives each a newly generated password on every run. The passwords are written only to `infra/idp/.local/test-users.json` (gitignored, mode 0600). The names are hints: API roles live in Tazumo's database (ADR-0016), so a fresh user has only `customer` until a role is granted there.

## Realm `tazumo` (`realm.json`)

- **Clients:** public only, Authorization Code with PKCE `S256` required. No password grant, implicit flow or service accounts.
  - `tazumo-web`: `http://localhost:5173/*` and `http://127.0.0.1:5173/*`.
  - `tazumo-native`: the app's `tazumo://auth/callback` and the Expo development URLs `exp://127.0.0.1:8081/--/auth/callback` and `exp://localhost:8081/--/auth/callback`, as redirect and post-logout URIs. The lint allows the custom scheme only for this exact URI on this client.
  - `tazumo-backoffice`: `http://127.0.0.1:5174/*` (dev server) and `http://127.0.0.1:4174/*` (preview).
  - `tazumo-audience-probe`: test only; its tokens lack the API audience.
- **Tokens:** access tokens are RS256 JWTs with header `typ: at+jwt` (RFC 9068, client attribute `access.token.header.type.rfc9068`), 300 s lifespan, and `aud` containing `tazumo-api` from an audience mapper on each app client. ID tokens do not carry `tazumo-api`.
- **Accounts:** self-registration with the e-mail address as username, e-mail verification, password reset, brute-force protection, password policy of 12 to 128 characters, not the e-mail, not one of the last three.
- **Registration order (Keycloak 26.8):** with e-mail verification on, the registration form asks only for e-mail and name. Keycloak sends the verification e-mail and asks for the password once the link is opened. No password is set before the address is proven.
- **E-mail:** sent to Mailpit (`mail:1025`), never delivered.

`tests/idp/realm-lint.mts` fails if the realm gains a client secret, a credential, a user, a confidential client, a non-localhost redirect, origin or post-logout URI, or loses PKCE, the audience mapper or the token lifespan bounds.

## Pointing the API at this realm

See [`apps/api/README.md`](../../apps/api/README.md#local-identity-provider). In short: `AUTH_ISSUER=http://127.0.0.1:48180/realms/tazumo`, `AUTH_AUDIENCE=tazumo-api`, `AUTH_JWKS_URL=http://127.0.0.1:48180/realms/tazumo/protocol/openid-connect/certs`, `AUTH_TOKEN_TYPE=at+jwt`.

## Pointing the back office at this realm

`apps/backoffice` already speaks OIDC with PKCE. Build or run it with:

```bash
VITE_OIDC_ISSUER=http://127.0.0.1:48180/realms/tazumo \
VITE_OIDC_CLIENT_ID=tazumo-backoffice \
VITE_OIDC_SCOPE=openid \
BACKOFFICE_API_URL=http://127.0.0.1:3001 \
pnpm --filter @tazumo/backoffice dev --port 5174 --strictPort
```

For the preview build use `preview --port 4174 --strictPort` (the realm allows 5174 and 4174, not Vite's default 4173). The IdP suite builds and serves the unchanged app exactly this way and signs a seeded user in through it. Leave `VITE_OIDC_RESOURCE` unset: Keycloak refuses `resource=tazumo-api` with `invalid_target` (and ignores absolute-URI resources), and the audience comes from the client's mapper.

## Pointing the web app at this realm

`apps/web` signs customers in with this realm ([ADR-0027](../../docs/adr/0027-client-auth.md)). Serve it on port 5173, the port the `tazumo-web` client allows:

```bash
VITE_OIDC_ISSUER=http://127.0.0.1:48180/realms/tazumo \
VITE_OIDC_CLIENT_ID=tazumo-web \
TAZUMO_API_URL=http://127.0.0.1:3001 \
pnpm --filter @tazumo/web dev --host 127.0.0.1 --port 5173 --strictPort
```

`TAZUMO_API_URL` makes the dev and preview servers proxy `/v1` to the API. Without `VITE_OIDC_ISSUER` and `VITE_OIDC_CLIENT_ID` the header says sign-in isn't available in this build. `apps/mobile` signs in with `tazumo-native` (see [its README](../../apps/mobile/README.md#sign-in)). `tests/idp/native-client.spec.ts` checks the native client's protocol against this realm: Authorization Code + PKCE on `tazumo://auth/callback`, refresh, RP-initiated logout, and refusal of other app-scheme paths.

## Tests

`.github/workflows/idp.yml` runs the realm lint, the password-field check (`tests/idp/no-password-fields.test.mts`), the Playwright suite in `tests/idp/` and the web sign-in suite in `tests/web-auth/` against this stack and a real `apps/api` server. Locally, with the stack up and a disposable database:

```bash
DATABASE_URL=postgres://... pnpm exec playwright test -c tests/idp/playwright.config.ts
DATABASE_URL=postgres://... pnpm exec playwright test -c tests/web-auth/playwright.config.ts
```

The IdP suite occupies `127.0.0.1:5173` (a stub for the web client's callback) and `127.0.0.1:4174` (the back-office preview), and the web suite serves the web app on `127.0.0.1:5173`, so run them one after the other and stop any dev server on those ports first. The last test waits until the registration token has expired (300 s plus the API's 60 s clock tolerance).
