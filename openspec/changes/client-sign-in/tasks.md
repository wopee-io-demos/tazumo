# Tasks

## Slice 1: web (this change)

- [x] ADR-0027: `oauth4webapi` vs `oidc-client-ts` vs the hand-written back-office flow on web, `expo-auth-session` vs `react-native-app-auth` vs WebView on native, the refresh strategy, discovery-based neutrality, memory-only web tokens and `expo-secure-store` on native.
- [x] `apps/web/src/auth/`: Authorization Code + PKCE `S256` with `state` and `nonce` via `oauth4webapi` 3.8.8; `prompt=create` for sign-up when discovery advertises it; `GET /v1/me` for the signed-in state; RP-initiated logout; refresh 30 s before expiry; unconfigured state. Header control with a disclosure account menu (Escape closes and returns focus) and `sut-auth-*` test IDs.
- [x] EN, CS and DE copy in `packages/core/src/account.ts`. Evidence: `pnpm --filter @tazumo/core test` (every key in every language, translations differ from English, no password wording).
- [x] Real-IdP browser E2E, locally on macOS (Docker Desktop, Keycloak 26.8.2 from `infra/idp`, Node 22, Chromium): `tests/web-auth/signin.spec.ts` 6/6 against the real realm and the real `apps/api` server, with the web app built with `VITE_OIDC_*` and served by `vite preview` on 127.0.0.1:5173. Covers sign-up with Mailpit verification, `/v1/me` state, RP-initiated sign-out ending the IdP session, forgot password on Keycloak, sign-in returning to `#/product/pizza`, refresh (Playwright clock fast-forward, real refresh-token grant), and that a reload ends only the local session.
- [x] Negative, same run: a tampered `state`, a wrong `iss`, a `nonce` mismatch and missing PKCE each end signed out with an error and no `/v1/me` call; Keycloak refuses a redirect URI outside the allowlist. No JWT or captured token in `localStorage`, `sessionStorage`, the URL or console output; no password input on Tazumo pages. Mutation check: with the app's state check replaced by `skipStateCheck` the tampered-state step fails.
- [x] Unconfigured build: `tests/e2e/auth.spec.ts` (EN, CS and DE text, no sign-in button, forged `code`/`state` ignored, no discovery, token or `/v1/me` request). Evidence: `pnpm test:e2e` 39/39 locally, including the a11y scans and the phone-width header check.
- [x] `.github/workflows/idp.yml` runs `tests/web-auth/` after the IdP suite.
- [ ] `idp.yml`, `check` and `evidence` green on the PR head.
- [ ] Independent review findings resolved.
- [ ] Selectors registered: listed on #32 while contract v0.2.0 (#90) is unmerged.

## Slice 2: native (separate PR)

- [ ] `expo-auth-session` with the system browser, PKCE and discovery; tokens in `expo-secure-store`; `tazumo://auth/callback` added to `tazumo-native` with a deliberate realm-lint extension; native smoke on at least one platform.
