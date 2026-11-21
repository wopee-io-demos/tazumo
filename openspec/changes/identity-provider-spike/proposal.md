# Identity provider spike: local Keycloak realm and real-IdP tests

## Why
Issue #87, consequence 1 of ADR-0017 (accepted 2026-11-21: self-hosted Keycloak in the EU). `apps/api` verifies tokens from any OIDC provider (ADR-0016), but it was tested only against an in-process JWKS. Sign-up, sign-in and password reset must happen at the identity provider, never in Tazumo's apps or API.

## What changes
- `infra/idp`: Keycloak, Mailpit and PostgreSQL pinned by digest, loopback ports, generated dev-only credentials, a versioned `tazumo` realm and a user seeding script with generated passwords.
- `tests/idp`: a realm lint, a password-field check over the API contract and app sources, and a Playwright suite against the real Keycloak and the real `apps/api` server.
- `.github/workflows/idp.yml` on GitHub-hosted runners.
- ADR-0017 accepted, with the spike findings. `apps/api/README.md` documents `AUTH_*` for the realm. No `apps/api` source changes.

## Out of scope
Production deployment, HA, backups and on-call; social login; MFA policy; wiring web, native and the back office (#88); provider-side account deletion in erasure (#56).

## Tracking
Issue #87, ADR-0017, ADR-0016.
