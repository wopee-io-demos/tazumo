# API authentication and authorization

## ADDED Requirements

### Requirement: Verified bearer tokens
The service SHALL accept on protected routes only bearer JWTs signed with RS256 or ES256 by a key in the configured JWKS, whose `iss` and `aud` match configuration, that carry `sub` and `exp`, and that are within `exp`/`nbf` allowing at most 60 seconds of clock skew.

#### Scenario: Missing or malformed credentials
- WHEN a protected route is called without a bearer token or with another scheme
- THEN the service responds 401 with `WWW-Authenticate: Bearer realm="tazumo"`.

#### Scenario: Invalid token
- WHEN the token is expired, not yet valid, for another audience or issuer, unsigned (`alg: none`), HMAC-signed, signed with an algorithm outside the allowlist, signed by an unknown `kid`, tampered, or lacks `sub` or `exp`
- THEN the service responds 401 with `error="invalid_token"` in the challenge.

#### Scenario: Key rotation
- WHEN the provider publishes a new signing key and retires the old one
- THEN tokens with the new `kid` verify after a refetch, tokens with the retired `kid` are rejected, and unknown `kid`s trigger no more than one refetch per cooldown.

#### Scenario: Provider keys unavailable
- WHEN the JWKS cannot be fetched or parsed, or authentication is not configured
- THEN protected routes respond 503 and never treat the request as authenticated.

### Requirement: Database-held identity and roles
The service SHALL map `(iss, sub)` to one user record on first use, grant it the `customer` role, store no profile data, and read roles only from its database.

#### Scenario: First and concurrent use
- WHEN one subject makes several first requests concurrently
- THEN exactly one user and one `customer` grant exist, and every response carries the same user ID.

### Requirement: Policy-based tenant isolation
The service SHALL authorize every protected read through one policy function. Unknown resources and resources a customer may not read SHALL return 404. Staff reading another tenant's resource SHALL get 403. Ownership SHALL also be enforced in the data query.

#### Scenario: Cross-tenant merchant staff list
- WHEN a customer, or staff of merchant A, requests the staff list of merchant B
- THEN the customer gets 404 and the staff member gets 403.

#### Scenario: Privileged read
- WHEN support or admin reads another merchant's staff list
- THEN the read succeeds and an append-only audit event records the actor, action, resource and request ID.

### Requirement: Anonymous discovery and private logs
Discovery endpoints SHALL stay anonymous and ignore any `Authorization` header. Logs SHALL contain neither tokens nor raw subjects, only a keyed hash of the principal.

#### Scenario: Bad token on a public route
- WHEN `GET /v1/markets` is called with an invalid bearer token
- THEN the response is 200.
