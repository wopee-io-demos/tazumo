# Identity provider

## ADDED Requirements

### Requirement: Versioned development realm
The repository SHALL provide a Keycloak realm for development and CI with public clients only, PKCE `S256` required, the password grant disabled, self-registration, e-mail verification, an IdP-handled password reset, access tokens of 300 to 900 seconds and an audience mapper that adds the API resource identifier to access tokens.

#### Scenario: Committed realm is safe
- WHEN the realm export contains a client secret, a credential, a user, a confidential client or a redirect, web origin or post-logout URI outside localhost
- THEN the realm lint fails in CI.

#### Scenario: Generated credentials
- WHEN the stack starts
- THEN the admin and database passwords and the test users' passwords are generated locally and written only to gitignored files.

### Requirement: Passwords stay at the identity provider
Tazumo's apps and API SHALL NOT accept a password. Registration, sign-in and password reset SHALL happen on the identity provider's pages.

#### Scenario: Registration and sign-in
- WHEN a user registers on the Keycloak page, opens the verification link captured by Mailpit, sets a password and completes Authorization Code + PKCE
- THEN `GET /v1/me` on the real API returns 200 with the `customer` role.

#### Scenario: Forgot password
- WHEN the user requests a reset, opens the link captured by Mailpit and sets a new password on the Keycloak page
- THEN the old password is refused, the new one signs in, and the API returns the same user.

#### Scenario: No password fields
- WHEN an API operation or an app source gains a password-like field or input
- THEN the password-field test fails.

#### Scenario: Password grant
- WHEN a client posts a username and password to the token endpoint
- THEN Keycloak refuses with `unauthorized_client`.

### Requirement: Real-IdP token checks
The API SHALL be exercised against tokens issued by the real Keycloak, in addition to the in-process JWKS tests.

#### Scenario: Wrong audience
- WHEN a token from a client without the API audience, or an ID token, is presented
- THEN the API answers 401 with `error="invalid_token"`.

#### Scenario: Expired token
- WHEN a real access token is presented after `exp` plus the 60 s clock tolerance
- THEN the API answers 401.
