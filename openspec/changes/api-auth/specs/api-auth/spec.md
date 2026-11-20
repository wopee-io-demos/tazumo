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

### Requirement: Rate limits on authenticated routes
The service SHALL limit requests to authenticated routes per client IP before token verification and per principal after authentication, and SHALL answer requests over the limit with 429, a `Retry-After` header and an `ApiError` body.

#### Scenario: Principal over its limit
- WHEN a principal exceeds its per-window limit
- THEN further requests get 429 with the seconds until the window resets, other principals are unaffected, and requests succeed again after the window.

#### Scenario: Token flood from one address
- WHEN one IP address exceeds its limit, even with invalid tokens
- THEN further requests get 429 without contacting the JWKS endpoint or creating users.

### Requirement: Admin role grants
The service SHALL let only admins grant and revoke `merchant_staff` (scoped to a merchant) and `support` roles, idempotently, SHALL forbid changes to the caller's own grants, and SHALL write every effective change to the audit log in the same transaction.

#### Scenario: Repeated grant
- WHEN an admin grants the same role twice
- THEN the first call returns 201, the second 200, and exactly one audit event exists.

#### Scenario: Escalation attempt
- WHEN a customer, merchant staff member or support user grants any role, or an admin changes their own grants
- THEN the service responds 403 and nothing changes.

#### Scenario: Unknown target
- WHEN the user or merchant does not exist
- THEN the service responds 404 and nothing changes.

### Requirement: Least-privilege runtime role
The service SHALL be runnable as a database role that can read the catalogue, manage users and grants, and only append to the audit log.

#### Scenario: Tampering with the audit log
- WHEN the runtime role tries to update, delete, truncate or read audit events, disable their triggers or drop the table
- THEN the database refuses.

### Requirement: GDPR erasure
The service SHALL let users erase themselves and let admin or support users erase others. In one transaction it SHALL replace the stored subject with a keyed hash, delete all role grants and write an audit event without personal data. It SHALL be idempotent, SHALL refuse erasure while dependent records exist, and SHALL reject tokens issued at or before the erasure.

#### Scenario: Self-service erasure
- WHEN an authenticated user requests erasure
- THEN their subject is pseudonymised, their grants are deleted, one `user:erase` audit event records only the initiator, and their existing tokens are rejected with 401.

#### Scenario: Repeated erasure
- WHEN an admin erases an already-erased user
- THEN the original `erasedAt` is returned and no second audit event is written.

#### Scenario: Erasing without permission
- WHEN a customer or merchant staff member asks to erase another user
- THEN the service responds 403 and nothing changes.

#### Scenario: Dependent records
- WHEN the target still holds an `admin` grant
- THEN the service responds 409 `erasure_blocked` with the list of blockers.

#### Scenario: Token issued after erasure
- WHEN a token for the same subject is issued after the erasure plus the clock tolerance
- THEN a new, unlinked user with only the `customer` role is provisioned, and erasing that user again succeeds.

#### Scenario: Support erasing staff
- WHEN a support user asks to erase a user with a support, merchant staff or courier grant
- THEN the service responds 409 `erasure_blocked` with blocker `staff_grant`.

#### Scenario: Grants to erased users
- WHEN anyone, including the runtime role directly, grants a role to an erased user
- THEN the grant is refused.

### Requirement: Personal data export
The service SHALL return to an authenticated user the identity data, role grants and audit events about them that Tazumo holds, including whitelisted event details, and nothing about other users. Audit rows SHALL be read through a function that returns per-user metadata only; the runtime database role SHALL NOT be able to SELECT the audit table directly.

#### Scenario: Export
- WHEN a user requests `GET /v1/me/export`
- THEN the response holds their issuer, subject, creation time, grants, and the audit events they caused or that concern them, marked `self` or `staff`.
