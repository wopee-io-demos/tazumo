# Client sign-in: web and native

## Why
Issue #88. Customers need to sign up, sign in and sign out through the identity provider's hosted pages (ADR-0017, realm from #87), and the apps need the signed-in caller from `GET /v1/me` (ADR-0016). There is no sign-in in `apps/web` or `apps/mobile`.

## What changes
- ADR-0027: `oauth4webapi` on web and `expo-auth-session` on native, the refresh strategy, discovery-based provider neutrality, memory-only tokens on web and `expo-secure-store` on native.
- `apps/web/src/auth/`: Authorization Code + PKCE with state and nonce, sign-up through `prompt=create`, `GET /v1/me` for the signed-in state, RP-initiated logout, refresh before expiry, and an "unavailable in this build" state when no provider is configured. A header control with an accessible account menu and `sut-auth-*` test IDs.
- `apps/web/vite.config.ts`: dev and preview proxy `/v1` to `TAZUMO_API_URL` when it is set.
- `packages/core/src/account.ts`: EN, CS and DE account copy.
- Tests: `tests/web-auth/` (real Keycloak, Mailpit and API, run by `idp.yml`) and `tests/e2e/auth.spec.ts` (unconfigured build).
- Slice 2: `apps/mobile/src/auth/` with `expo-auth-session`, `expo-secure-store` and `expo-web-browser`; `tazumo://auth/callback` on `tazumo-native` with a deliberate realm-lint extension; `tests/idp/native-client.spec.ts`; the Android smoke checks the unconfigured state; contract v0.4.0.

## Out of scope
Account and privacy screens (#89), roles UI, social login, moving `apps/backoffice` to `oauth4webapi`.

## Tracking
Issue #88, ADR-0027, ADR-0016, ADR-0017, #87.
