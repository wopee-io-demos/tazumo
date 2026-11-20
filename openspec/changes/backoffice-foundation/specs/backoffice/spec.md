# Back office

## ADDED Requirements

### Requirement: Role-gated navigation
The back office SHALL read the principal's grants from `GET /v1/me` and SHALL show Role grants only to admins, one My merchants entry per `merchant_staff` grant, and a read-only staff lookup to support and admins.

#### Scenario: Customer-only principal
- WHEN a principal with only the `customer` role signs in
- THEN the app shows "No back-office access" and makes no API request other than `GET /v1/me`.

#### Scenario: Another merchant's staff list
- WHEN staff of merchant A open merchant B's staff list
- THEN the API answers 403 and the app shows an access-denied page.

### Requirement: Role grants
The back office SHALL let admins grant and revoke only `merchant_staff` (for a chosen merchant) and `support`, and SHALL show the API's 400, 403 and 404 responses as plain-language messages.

#### Scenario: Grant and revoke support
- WHEN an admin grants `support` to a user, grants it again and then revokes it
- THEN the app reports granted, no change and revoked in turn.

#### Scenario: Non-admin
- WHEN a support user opens the role grants page or calls the admin API directly
- THEN no grant controls are rendered and the API answers 403.

#### Scenario: Admin or courier roles
- WHEN the role list is shown
- THEN it offers only Merchant staff and Support.

### Requirement: Session handling
The back office SHALL sign in with OIDC Authorization Code and PKCE, SHALL keep access tokens in memory only, and SHALL report the back office as unavailable when the API answers 503.

#### Scenario: Expired session
- WHEN the access token expires or the API answers 401
- THEN the app returns to sign-in with a session-expired notice.

#### Scenario: Token storage
- WHEN a user has signed in
- THEN `localStorage` and `sessionStorage` are empty.

#### Scenario: API without auth configuration
- WHEN `GET /v1/me` answers 503
- THEN the app says the back office is unavailable and shows no data.

#### Scenario: Production bundle
- WHEN the app is built
- THEN the bundle contains no token-minting code, test principals or token storage.

### Requirement: Accessibility
Every back-office page SHALL have no serious or critical axe violations and SHALL be operable with the keyboard alone.

#### Scenario: Keyboard-only grant
- WHEN an admin uses only the keyboard to open Role grants, enter a user ID, choose Support, grant and revoke
- THEN each step succeeds and the result is announced in a live region.
