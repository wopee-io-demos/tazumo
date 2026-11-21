# Back-office console foundation

## Why
Issue #91 (from the gap analysis in #26). Merchant staff, support and admins have no UI for the roles, staff lists and role grants that `apps/api` already serves. The merchant console (#92) and admin console (#93) need a shell, an auth layer and a role-gated navigation to build on.

## What changes
- New app `apps/backoffice` (Vite + React, `@tazumo/brand`), separate from the consumer app (ADR-0024).
- An `AuthProvider` interface with a provider-neutral OIDC Authorization Code + PKCE implementation; the access token is held in memory only.
- Navigation by role from `GET /v1/me`: admin gets Role grants, merchant staff get My merchants (each opening its staff list), support and admin get a read-only staff lookup.
- A role grants page for `merchant_staff` and `support`, with the API's 400, 403 and 404 errors shown in plain language.
- E2E suite in `tests/backoffice/` against the real `apps/api` and PostgreSQL with a loopback test identity provider, plus a bundle check; CI workflow `backoffice.yml`.

## Out of scope
Merchant profile, menu and availability editing (#92); user directory, onboarding review, orders and audit log (#93); deployment; a real IdP (#87). English only.

## Tracking
Issue #91, ADR-0024.
