# Tasks

- [x] ADR-0017 accepted (owner decision 2026-11-21) with spike findings: access token `typ` is `at+jwt`, audience via mapper, 300 s lifespan, issuer pinned by `KC_HOSTNAME`, password set after e-mail verification.
- [x] `infra/idp/compose.yml`: Keycloak 26.8.2, Mailpit v1.34.0, PostgreSQL 17.12, pinned by digest, ports on 127.0.0.1 only. Evidence: `bash infra/idp/up.sh` brings all three to healthy in about 40 s on macOS (Docker Desktop).
- [x] `infra/idp/realm.json`: four public PKCE clients, registration, e-mail verification, reset, 300 s access tokens, `tazumo-api` audience mapper. Evidence: `realm-lint.mts` passes; the Playwright suite exercises the clients, PKCE, registration, verification, reset, lifespan and audience. Brute-force protection, the password policy values and the mail sender are configured but not exercised.
- [x] Test users seeded with generated passwords into a gitignored file. Evidence: the seeded-user test signs in with the generated password through the unchanged `apps/backoffice` build configured with the documented `VITE_OIDC_*` values (customer sees "No back-office access").
- [x] Realm lint fails on a secret, a credential, a non-localhost URI and the other unsafe settings. Evidence: 20 mutation tests in `realm-lint.test.mts` (also device grant, CIBA, token exchange and logout URLs).
- [x] No app or API route accepts a password field. Evidence: `no-password-fields.test.mts` over `contracts/openapi.json` and all app sources, with detector self-tests.
- [x] Real Keycloak against the real API, locally: registration with Mailpit verification, PKCE, `GET /v1/me` 200; `resource=tazumo-api` refused with `invalid_target`; other audience (also with an absolute-URI `resource`) and ID token (`typ: JWT`, `aud` = client ID) 401; PKCE and password grant refused; reset via Mailpit, old password fails, new works; seeded user signs in; expired token 401. Evidence: 6/6 Playwright tests (macOS, Node 22, Chromium).
- [x] `apps/api/README.md` documents `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, `AUTH_TOKEN_TYPE` for the realm; `infra/idp/README.md` documents the back-office settings.
- [ ] `.github/workflows/idp.yml` green on the PR head.
- [ ] Independent review findings resolved.
