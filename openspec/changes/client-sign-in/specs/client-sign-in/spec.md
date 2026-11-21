# Client sign-in

## ADDED Requirements

### Requirement: Hosted sign-in, sign-up and sign-out on web
The web app SHALL sign customers in and up through the identity provider's hosted pages with OIDC Authorization Code + PKCE `S256`, `state` and `nonce`, using endpoints from the issuer's discovery document. It SHALL NOT render a password field.

#### Scenario: Sign-up with e-mail verification
- WHEN a visitor chooses "Create account", registers on the provider's page, opens the verification link captured by Mailpit and sets a password there
- THEN the web app shows the account menu for that e-mail address and `GET /v1/me` has returned the `customer` role.

#### Scenario: Sign-in returns to the starting page
- WHEN a visitor starts sign-in from a product page and signs in on the provider's page
- THEN the app returns to that product page, signed in, with no authorization parameters left in the URL.

#### Scenario: Forgot password
- WHEN the visitor follows "Forgot password" on the provider's sign-in page
- THEN the reset happens on the provider's pages and ends signed in to the same user.

#### Scenario: Sign-out ends the provider session
- WHEN a signed-in customer chooses "Sign out"
- THEN the app is signed out, and the next sign-in asks for credentials again.

### Requirement: Tokens stay in memory
The web app SHALL keep access, refresh and ID tokens in memory only, refresh the access token before it expires, and keep tokens out of `localStorage`, `sessionStorage`, URLs and console output.

#### Scenario: Refresh
- WHEN the access token is 30 seconds from expiry
- THEN the app refreshes it with the refresh-token grant and stays signed in.

#### Scenario: No token in storage, URL or logs
- WHEN a customer has signed in, refreshed or signed out
- THEN no token appears in browser storage, the URL or the console.

### Requirement: Rejected callbacks
The web app SHALL reject a callback whose `state` or `iss` does not match, an ID token whose `nonce` does not match, and an error response, and SHALL NOT create a session or call the API in those cases.

#### Scenario: Tampered callback
- WHEN the callback carries a tampered `state`, a wrong `iss`, an ID token with another `nonce`, or the provider's error for a request without PKCE
- THEN the control shows an error, stays signed out and `GET /v1/me` is not called.

#### Scenario: Redirect URI outside the allowlist
- WHEN an authorization request names a redirect URI the client does not allow
- THEN the provider refuses it on its own page and does not redirect.

### Requirement: Builds without a provider
A web build without `VITE_OIDC_ISSUER` and `VITE_OIDC_CLIENT_ID` SHALL state that sign-in isn't available in this build, in the selected language, and SHALL NOT create a session.

#### Scenario: Public preview
- WHEN the app is built without auth configuration and opened, even with `code` and `state` in the URL
- THEN the control says sign-in isn't available, offers no sign-in button and makes no discovery, token or `/v1/me` request.

### Requirement: Native sign-in in the system browser
The native app SHALL sign customers in and up with OIDC Authorization Code + PKCE in the system browser through `expo-auth-session`, redirecting to `tazumo://auth/callback`. It SHALL keep the refresh token and ID token only in `expo-secure-store` and the access token in memory. It SHALL take the signed-in state from `GET /v1/me` and SHALL NOT use an embedded WebView or render a password field.

#### Scenario: Native client against the realm
- WHEN the native client completes Authorization Code + PKCE on `tazumo://auth/callback` with a nonce
- THEN the callback carries the same `state` and the realm's `iss`, the tokens reach `GET /v1/me`, refresh works, and RP-initiated logout redirects back to the app scheme.

#### Scenario: Other app-scheme paths
- WHEN an authorization or logout request names `tazumo://` with another path
- THEN the provider refuses it.

#### Scenario: Rejected native responses
- WHEN discovery names another issuer, the callback `iss` differs, or the ID token's `iss`, `aud` or `nonce` does not match
- THEN the app stays signed out with an error, stores nothing and does not call the API.

#### Scenario: Restart
- WHEN the app starts with a stored refresh token
- THEN it refreshes, calls `/v1/me` and shows the signed-in state; if the refresh fails it deletes the stored tokens.

#### Scenario: Native build without a provider
- WHEN the app is bundled without `EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID` and `EXPO_PUBLIC_API_URL`
- THEN the catalogue says sign-in isn't available in this build.

