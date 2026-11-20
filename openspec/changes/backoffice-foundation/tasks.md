# Tasks

- [x] ADR-0024: separate app versus routes in `apps/web`, a separate repository, server-rendered admin, token storage, backend-for-frontend and mocked E2E.
- [x] `apps/backoffice` with Vite + React and `@tazumo/brand`, in `pnpm -r typecheck`, with its own build script. Evidence: `pnpm typecheck` and `pnpm --filter @tazumo/backoffice build`.
- [x] OIDC Authorization Code + PKCE provider behind `AuthProvider`. Evidence: every E2E sign-in runs the real flow against the loopback provider, which verifies the PKCE verifier.
- [x] Role-gated navigation, staff list and staff lookup. Evidence: `tests/backoffice/backoffice.spec.ts` (staff list, 403 for another merchant enforced by the API, lookup as support).
- [x] Role grants with plain-language 400, 403 and 404 messages; only Merchant staff and Support offered. Evidence: the grants and errors tests.
- [x] Negative cases: customer-only principal makes only `GET /v1/me`; no admin controls for support and the API answers 403; 503 shows unavailable; storage is empty after sign-in; bundle check. Evidence: the corresponding tests and `tests/backoffice/check-bundle.mjs`.
- [x] axe (no serious or critical violations) on the signed-out, no-access, staff list, access-denied, grants and unavailable pages; keyboard-only grant flow.
- [x] Mutation check: rendering the grants navigation and page for every role fails two tests.
- [ ] Current-head CI green on the PR.
- [ ] Review findings resolved; merge SHA recorded on #91.

Local evidence (macOS, Node 22.19.0, PostgreSQL 16 in a local container): 9/9 Playwright tests pass, twice in a row against the same database.
