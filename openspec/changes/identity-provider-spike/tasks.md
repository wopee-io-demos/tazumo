# Tasks

- [x] ADR-0017 accepted (owner decision 2026-11-21) with spike findings: access token `typ` is `at+jwt`, audience via mapper, 300 s lifespan, issuer pinned by `KC_HOSTNAME`, password set after e-mail verification.
- [x] `infra/idp/compose.yml`: Keycloak 26.8.2, Mailpit v1.34.0, PostgreSQL 17.12, pinned by digest, ports on 127.0.0.1 only. Evidence: `bash infra/idp/up.sh` brings all three to healthy in about 40 s on macOS (Docker Desktop).
- [x] `infra/idp/realm.json`: four public PKCE clients, registration, e-mail verification, reset, 300 s access tokens, `tazumo-api` audience mapper. Evidence: `realm-lint.mts` passes and the Playwright suite exercises every setting.
- [x] Test users seeded with generated passwords into a gitignored file. Evidence: the seeded-user test signs in through `tazumo-backoffice` with the generated password.
- [x] Realm lint fails on a secret, a credential, a non-localhost URI and the other unsafe settings. Evidence: 16 mutation tests in `realm-lint.test.mts`.
- [x] No app or API route accepts a password field. Evidence: `no-password-fields.test.mts` over `contracts/openapi.json` and all app sources, with detector self-tests.
- [x] Real Keycloak against the real API, locally: registration with Mailpit verification, PKCE, `GET /v1/me` 200; other audience and ID token 401; PKCE and password grant refused; reset via Mailpit, old password fails, new works; seeded user signs in; expired token 401. Evidence: 6/6 Playwright tests (macOS, Node 22, Chromium).
- [x] `apps/api/README.md` documents `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, `AUTH_TOKEN_TYPE` for the realm; `infra/idp/README.md` documents the back-office settings.
- [ ] `.github/workflows/idp.yml` green on the PR head.
- [ ] Independent review findings resolved.
