# Tasks

- [x] ADR-0024: separate app versus routes in `apps/web`, a separate repository, server-rendered admin, token storage, backend-for-frontend and mocked E2E.
- [x] `apps/backoffice` with Vite + React and `@tazumo/brand`, in `pnpm -r typecheck`, with its own build script. Evidence: `pnpm typecheck` and `pnpm --filter @tazumo/backoffice build`.
- [x] OIDC Authorization Code + PKCE provider behind `AuthProvider`. Evidence: every E2E sign-in runs the real flow against the loopback provider, which verifies the PKCE verifier.
- [x] Role-gated navigation, staff list and staff lookup. Evidence: `tests/backoffice/backoffice.spec.ts` (staff list, 403 for another merchant enforced by the API, lookup as support).
- [x] Role grants with plain-language 400, 403 and 404 messages; only Merchant staff and Support offered. Evidence: the grants and errors tests.
- [x] Negative cases: customer-only principal makes only `GET /v1/me`; no admin controls for support and the API answers 403; 503 shows unavailable; storage is empty after sign-in; bundle check. Evidence: the corresponding tests and `tests/backoffice/check-bundle.mjs`.
- [x] axe (no serious or critical violations) on the signed-out, no-access, staff list, access-denied, not-for-role, staff lookup, grants (including an error result) and unavailable pages. Keyboard-only passes for sign-in, staff lookup, staff list, sign-out, the grants flow and the skip link.
- [x] Mutation check: rendering the grants navigation and page for every role fails two tests.
- [x] Expired session returns to sign-in with a notice. Evidence: the expiry test fast-forwards the page clock six minutes past the 300 s token lifetime.
- [x] Independent review on f4f7dc1: no blockers, seven should-fix items, all fixed: skip link no longer changes the route and `<main>` takes focus; keyboard tests use Tab only and cover every page; axe on the lookup, not-for-role and error pages; merchants chosen from the staff principal's grant; target grants reset before each test; 401 or expiry signs out with a notice; ADR wording. Nits fixed: 403/404 fallbacks, header merging, heading on the not-for-role page, focus on route change, the request assertion runs after axe, the stack is ready only when both APIs listen. Not done: the `docs/adr/README.md` entry (shared file edited by several open PRs) and typechecking of the test `.mts` files.
- [x] CodeQL `js/server-side-unvalidated-url-redirection` in the test IdP (found on 2b7ea40): the authorize endpoint now keeps only the allowlisted redirect URI constant, and the redirect is built from it with `URL.searchParams`.
- [x] Re-review on 2b7ea40: all seven should-fix items resolved, no blockers. Then fixed: the expiry test uses the page clock instead of a 1 s token (load flake); cleanup statuses are asserted; route-change focus is StrictMode-safe; web-server timeouts raised. Left as nits: `merchant_not_found` test, RFC 9207 `iss` check, the `docs/adr/README.md` entry and typechecking of the test `.mts` files.
- [ ] Current-head CI green on the PR.
- [ ] Review findings resolved; merge SHA recorded on #91.

Local evidence (macOS, Node 22.19.0, PostgreSQL 16 in a local container): 11/11 Playwright tests pass, repeatedly against the same database.
