# ADR-0027: Customer sign-in on web and native clients

Status: Accepted (web in slice 1; the native part is confirmed with slice 2)
Date: 2026-11-21
Tracking: issue [#88](https://github.com/wopee-io-demos/tazumo/issues/88), OpenSpec `client-sign-in`, builds on ADR-0016 (API token verification) and ADR-0017 (Keycloak)

## Context

Customers sign up, sign in and sign out from the web app (`apps/web`) and the Expo app (`apps/mobile`). ADR-0017 picked Keycloak, and `infra/idp` (#87) provides a realm with public PKCE clients `tazumo-web` and `tazumo-native` whose access tokens carry `typ: at+jwt` and the `tazumo-api` audience. The API resolves the caller with `GET /v1/me` (ADR-0016). Tazumo never shows a password field: registration, sign-in and password reset happen on the provider's hosted pages.

Constraints:
- **Provider neutrality:** the clients know only an issuer URL and a client ID. Every endpoint comes from the issuer's discovery document, so another OIDC provider (ADR-0017's alternatives) is a configuration change.
- **Token storage:** web keeps tokens in memory only (no `localStorage`, `sessionStorage`, cookies or URLs). Native keeps them in `expo-secure-store` (Keychain / Keystore). Tokens never appear in logs.
- **Unconfigured builds:** the public GitHub Pages preview (ADR-0025) has no provider. Sign-in must say so and never fake a session.

## Options for the web client

| | `oauth4webapi` (chosen) | `oidc-client-ts` | Hand-written flow (as in `apps/backoffice`) |
| --- | --- | --- | --- |
| **Scope** | Low-level, certified OAuth 2 / OIDC functions: discovery, PKCE, state and nonce, `iss` (RFC 9207), ID token validation, refresh | High-level `UserManager`: redirects, popups, silent renew, session monitoring | Discovery, PKCE and state only |
| **Token storage** | Whatever the app does with the returned object; memory is the natural default | `WebStorageStateStore` over `sessionStorage` by default; memory needs `InMemoryWebStorage` and careful configuration of every store | App-defined |
| **Validation** | ID token `iss`, `aud`, `azp`, `exp`, `nonce`; authorization response `state` and `iss`; error responses typed | Similar, inside the manager | Only what we write; no ID token or `iss` check |
| **Size and dependencies** | No dependencies, tree-shakable, about 330 kB unpacked | One dependency (`jwt-decode`), about 1.7 MB unpacked | None |
| **Refresh** | `refreshTokenGrantRequest` called by our timer | Built-in silent renew via iframe (`prompt=none`) or refresh token | Not implemented |
| **Maintenance** | Single maintainer (panva, also `jose` used by the API, ADR-0016), OpenID-certified | Community project, larger API surface | Ours |

`oauth4webapi` keeps the storage rule explicit and adds the checks the hand-written back-office flow lacks. `oidc-client-ts` would work, but its defaults put the user (tokens included) in `sessionStorage`, its silent renew depends on third-party cookies for iframes, and most of its surface would be unused.

## Options for the native client (slice 2)

- **`expo-auth-session` (chosen):** Expo's maintained OAuth helper. It opens the system browser (`ASWebAuthenticationSession` on iOS, Custom Tabs on Android), generates PKCE, reads discovery with `useAutoDiscovery(issuer)`, and works in Expo Go and dev builds. Tokens go to `expo-secure-store`.
- **`react-native-app-auth`:** wraps AppAuth-iOS/Android, which is mature, but it needs a config plugin and native rebuilds and does not run in Expo Go.
- **Embedded WebView:** rejected. RFC 8252 forbids it for OAuth, the app could read credentials, and passkeys and password managers break.

The redirect is the app scheme `tazumo://auth/callback` plus the Expo development URLs already in the realm. Adding the scheme to `tazumo-native` means extending the realm lint on purpose, because it accepts only loopback URIs today.

## Decision

1. **Web:** `oauth4webapi`, Authorization Code with PKCE `S256`, `state` and `nonce`. The issuer, client ID and scope come from the build (`VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_SCOPE`). Plain `http` is accepted only for a loopback issuer. The authorization response is checked for `state` and `iss`, and the ID token for issuer, audience and `nonce`. The redirect URI is the app's base URL. The original hash route is kept in the sign-in transaction and restored after the callback, and the query is removed from the URL before any network call.
2. **Sign-up** uses the same flow with `prompt=create` when the discovery document lists `create` in `prompt_values_supported` (Keycloak does). Otherwise it falls back to the sign-in page, which links to registration. **Forgot password** is the provider's own link on its sign-in page; Tazumo has no reset screen.
3. **Signed-in state** is what `GET /v1/me` returns with the access token. The ID token's `email` is only shown, never stored. A 401 from `/v1/me` ends the local session.
4. **Sign-out** clears memory and then sends the browser to the discovery document's `end_session_endpoint` with `id_token_hint`, `client_id` and `post_logout_redirect_uri` (RP-initiated logout), so the provider session ends too.
5. **Token refresh:** the refresh token stays in memory next to the access token. A timer refreshes 30 s before `expires_in` (300 s in the realm) with the refresh-token grant. If the refresh fails, the session ends and the control says so. A full page reload drops the in-memory session. The next "Sign in" click completes without a password while the provider's SSO session lasts (30 min idle in the realm). Silent restore on load (`prompt=none`) is not done, because it needs a redirect on every load or a third-party-cookie iframe.
6. **Storage:** `sessionStorage` holds only the sign-in transaction (`state`, `nonce`, PKCE verifier, return route) between the redirect and the callback, and the callback deletes it before using it. No access, refresh or ID token is ever written to browser storage.
7. **Unconfigured builds:** without `VITE_OIDC_ISSUER` and `VITE_OIDC_CLIENT_ID` the control states that sign-in isn't available in this build. No discovery request is made, and callback parameters are ignored.
8. **API calls** go to same-origin `/v1`. Vite's dev and preview servers proxy it to `TAZUMO_API_URL`. A deployed web app needs the same reverse proxy, or CORS on the API.
9. **Native (slice 2):** `expo-auth-session` with the system browser, PKCE, discovery from the issuer, refresh with the refresh-token grant, and tokens in `expo-secure-store`.

## Consequences

- Another OIDC provider is a matter of configuration as long as it supports discovery, PKCE `S256`, refresh tokens for public clients and RP-initiated logout. Without `end_session_endpoint`, sign-out is local only.
- `oauth4webapi` adds about 19 kB minified (6.5 kB gzip) to the web bundle, including builds that have no sign-in.
- Each reload or new tab starts signed out locally. This is the price of memory-only tokens. Revisit if customers find it disruptive (for example with a backend-for-frontend holding an HTTP-only session cookie).
- The refresh token is as exposed to injected script as the access token. The content security policy and dependency audit are the defences; a backend-for-frontend would remove it from the browser altogether.
- Slice 1 sends the bearer token only on `GET /v1/me`. The first other protected call (the account screens, #89) adds an authorised fetch to the same module, which ends the session on a 401.
- `apps/backoffice` keeps its hand-written flow for now. Moving it to `oauth4webapi` would add the `iss` and nonce checks.
- E2E runs against the real realm and API in `.github/workflows/idp.yml` (`tests/web-auth/`).
