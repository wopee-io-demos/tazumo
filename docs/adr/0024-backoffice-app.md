# ADR-0024: Back office as a separate web app

Status: Proposed
Date: 2026-11-20
Tracking: issue #91 (from #26), OpenSpec `backoffice-foundation`, builds on ADR-0012 and ADR-0016

## Context

Merchant staff, support and admins need a web UI for the roles, staff lists and grants that `apps/api` already serves (#62, #66). In the earlier prototype, `/operator` and `/admin` routes lived inside the consumer app and were guarded only on the client. The merchant console (#92) and admin console (#93) will build on whatever we choose here.

## Decision

1. **A separate Vite + React app, `apps/backoffice`**, with the same toolchain as `apps/web`, `@tazumo/brand` tokens and hash routes (ADR-0012). The consumer bundle contains no back-office code, and the back-office bundle contains no consumer code.
2. **The API decides access.** The app reads roles from `GET /v1/me` only to choose which navigation to show. A customer-only principal sees "No back-office access" and the app makes no other request. Every protected read and write is still authorised by the API (`can()` and ownership in SQL), so hidden controls are a convenience, not the boundary.
3. **Auth behind an `AuthProvider` interface.** The first implementation is provider-neutral OIDC Authorization Code with PKCE (S256), driven by the issuer's discovery document. Only the issuer, client ID, scope and an optional `resource` are configured. The access token lives in memory only, so a reload means signing in again, and any 401 or token expiry returns the user to sign-in. Only the PKCE `state` and verifier sit in `sessionStorage`, and only for the length of the redirect.
4. **The API is reached on the same origin.** The dev and preview servers proxy `/v1` to `apps/api`, and a deployment must put the app and the API behind one origin through a reverse proxy. `apps/api` therefore needs no CORS, and the strict CSP `connect-src 'self' <issuer>` stays possible.
5. **E2E runs against the real API with a loopback test identity provider.** `tests/backoffice/stack.mts` serves discovery, an authorize page, a PKCE-checked token endpoint and a JWKS on 127.0.0.1. It signs RS256 tokens with `node:crypto` and inserts principals and grants as the schema owner. The app runs its real PKCE code against it. A bundle check in CI fails if token-minting code, test principals, `localStorage` use or a token literal appears in the build. The E2E suite checks that both storages are empty after sign-in.

## Alternatives

| Option | Why not |
| --- | --- |
| Routes inside `apps/web` | Back-office code and role names ship to every customer. The two need different CSP and caching. Back-office releases would be coupled to consumer releases. Lazy loading reduces the first two but does not remove them. |
| A separate repository | Loses the shared `@tazumo/brand` package, typed fixtures and a single CI. Too heavy for a prototype. |
| Server-rendered admin (for example AdminJS on Fastify) | Puts UI in `apps/api`, which another agent owns, and talks to the database directly instead of going through the audited API. |
| Token in `localStorage` | Readable by any injected script and survives the tab. The in-memory token plus the IdP session gives the same convenience after a fresh sign-in. |
| Backend-for-frontend with session cookies | Closest to best practice for browser apps. It needs a server component and CSRF handling, though, and can replace the in-memory provider behind the same interface once the IdP (ADR-0017, #87) is chosen. |
| Mocked API in E2E | Cannot show that the API, not the UI, enforces 403 for another merchant or for non-admin grant calls. |

## Consequences

- Deployment needs a same-origin reverse proxy and an IdP client registered with the app's redirect URI. Neither exists yet (#87).
- The back office is English only and not customer-facing. Localisation follows when the merchant console is scoped.
- Each reload returns to the Sign in button. With an active IdP session, signing in again is a redirect round trip, not a password prompt.
- `apps/api` is unchanged. Merchant-operations routes arrive with #75 and the console with #92.
