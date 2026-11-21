# Design: back-office console foundation

Decisions and alternatives are in ADR-0024.

## App structure
| File | Role |
| --- | --- |
| `src/auth.ts` | `AuthProvider` interface and `createOidcProvider` (discovery, PKCE S256, `state` check, in-memory token with expiry). |
| `src/api.ts` | Fetch client that adds the bearer token, maps errors to `ApiError(status, code)`, and loads merchants through `GET /v1/markets` and `GET /v1/merchants`. |
| `src/main.tsx` | Session states (starting, signed out, unavailable, ready), role checks, hash routes `#/grants`, `#/lookup`, `#/merchants/{id}/staff`, prototype banner, skip link, focus moved to `<main>` on route changes, sign-out on any 401. |
| `src/pages.tsx` | Staff list (403 and 404 pages), staff lookup, role grants form. |

Configuration happens at build time: `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, and optionally `VITE_OIDC_SCOPE` (default `openid`) and `VITE_OIDC_RESOURCE`. The dev and preview servers proxy `/v1` to `BACKOFFICE_API_URL` (default `http://127.0.0.1:3001`).

## Error mapping on the grants page
| API answer | Message |
| --- | --- |
| 201 / 200 | Granted / No change |
| 204 | Revoked (if it was granted); the API does not say whether anything was removed |
| 400 | The request was not valid. Check the user ID, and choose a merchant for merchant staff. |
| 403 | Not allowed to change roles for this user; admins cannot change their own roles. |
| 404 `user_not_found` / `merchant_not_found` | No user with this ID exists (users appear after first sign-in) / that merchant does not exist. |
| 401, 429, 503 | Session expired / too many requests / unavailable. |

## Test stack
`tests/backoffice/stack.mts` starts:
- a loopback OIDC provider with discovery, `/authorize` (one link per seeded principal), `/token` (checks the PKCE verifier, client and redirect URI, single-use codes), `/jwks.json` and a test-only `/test-token` used by specs for direct API calls;
- the real `apps/api` twice (with auth, and without auth for the 503 case), migrated and seeded;
- principals `bo-admin`, `bo-support`, `bo-staff-a` (staff of the first merchant), `bo-customer` and `bo-target`, inserted with their grants as the schema owner and reset on every start. Each test also revokes `bo-target`'s grants first, so retries start clean.

Playwright starts the web servers in order: the stack (ready once the IdP listens, after both APIs), then the build plus a preview proxied to the authenticated API, then a second preview of the same build proxied to the API without auth. Ports start at `BACKOFFICE_E2E_PORT_BASE` (default 47310).
