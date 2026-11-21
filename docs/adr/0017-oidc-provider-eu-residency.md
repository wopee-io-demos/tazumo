# ADR-0017: OIDC provider for EU data residency

Status: **Proposed.** The decision belongs to the repository owner.
Date: 2026-11-20
Tracking: issue #56, ADR-0016 (token verification is provider-neutral)

## Context

ADR-0016 verifies access tokens from any OIDC provider that publishes a JWKS and issues RS256 or ES256 tokens for a configured audience. Tazumo stores only `(issuer, subject)` per user. Names, e-mail addresses, credentials and MFA factors live with the provider. The provider therefore holds most of the personal data, and its location, legal exposure and erasure tooling decide our GDPR posture.

Requirements:
- **Residency:** personal data stored and processed in the EU or EEA.
- **Legal exposure:** minimal exposure to non-EU access regimes, where feasible.
- **Erasure:** a per-user erasure API.
- **Standards:**
  - OIDC Authorization Code + PKCE for web and native.
  - Access tokens as JWTs with a dedicated audience, ideally with an RFC 9068 `at+jwt` type.
  - Short token lifetimes.
- **Operations and cost:** a burden that fits a small team at prototype stage, and a cost that stays low until real users exist.

Pricing and contract terms change often. The figures below are indicative and must be checked against current vendor terms before any decision.

## Options

| | Keycloak, self-hosted in the EU | Zitadel, self-hosted in the EU (Zitadel Cloud as a managed variant) | Auth0, EU region | Microsoft Entra External ID | Ory Network, EU |
| --- | --- | --- | --- | --- | --- |
| **Who controls the data** | We do, on EU infrastructure we choose (for example an EU-owned host in Germany or Finland) | We do when self-hosted. The vendor is Swiss; Zitadel Cloud offers regional hosting | Okta, a US company. Tenant data is stored in the EU region | Microsoft, a US company. Tenant location is chosen at creation, and the EU Data Boundary applies | Ory (founded in Germany; verify the contracting entity). EU data location is selectable |
| **Non-EU legal exposure** | Only what our hosting provider brings (none with an EU-owned host) | None when self-hosted; Switzerland has an EU adequacy decision. **Zitadel Cloud** reportedly runs on a US hyperscaler, which brings the same CLOUD Act / FISA sub-processor exposure as the US vendors; verify the sub-processor list | US parent: CLOUD Act / FISA exposure; transfers rely on the EU–US Data Privacy Framework or SCCs | Same US-parent exposure as Auth0, mitigated by the EU Data Boundary commitments (which have documented exceptions; confirm External ID coverage) | Reportedly hosted on a US hyperscaler, so there is sub-processor exposure similar to Zitadel Cloud; verify the sub-processor list |
| **Licence** | Apache 2.0, CNCF project | AGPL-3.0 (since v3), commercial licence available | Proprietary SaaS | Proprietary SaaS | Proprietary SaaS on Apache-2.0 open-source components (Kratos, Hydra, Keto) |
| **Cost at prototype scale** | Infrastructure only: one small VM plus managed or self-run PostgreSQL. The real cost is operations time | Infrastructure only, or Zitadel Cloud's usage-based plans | Free tier for low MAU (advertised at about 25k), then steep per-MAU tiers. Enterprise features cost extra | Free tier for low MAU (advertised at about 50k), then per-MAU pricing | Free developer tier; production plans are a monthly subscription |
| **Ops burden** | **Highest:** upgrades (frequent majors), HA, backups, patching, theming, monitoring, our own incident response | **High:** a single Go binary on PostgreSQL is simpler than Keycloak, but HA, backups and upgrades are still ours | **Low** | **Low.** Configuration is Azure-centric | **Low** |
| **RFC 9068 `at+jwt` access tokens** (needed for `AUTH_TOKEN_TYPE`) | Per-client option for the `at+jwt` header (verify in the spike) | Verify | RFC 9068 token profile selectable per API (verify) | Access tokens carry `typ: JWT`, not `at+jwt`, so leave `AUTH_TOKEN_TYPE` unset and rely on the audience | Verify (Hydra) |
| **Standards fit** | OIDC-certified; audiences via client scopes and mappers; fine-grained token configuration | OIDC-certified; project and role model built in; JWT access tokens per application | OIDC-certified; API audiences built in; mature SDKs | OIDC; `sub` is pairwise per application, and `oid` is the stable object ID | OIDC-certified (Hydra); headless identity flows |
| **Local and CI testing** | Official container: real-IdP integration tests in CI are easy | Official container | Needs a cloud tenant per environment | Needs a cloud tenant per environment | Open-source components run locally; the network product is cloud-only |
| **Lock-in** | Low: standard OIDC, exportable realm | Low to medium | Medium: rules/actions and user export constraints | Medium to high: tied to Azure tenancy | Medium |

## GDPR pseudonymisation impact

Every option uses the same erasure pattern on Tazumo's side:

1. Delete the account at the provider. Until a provider is chosen and wired in, this is an operator step.
2. In one transaction (implemented in #56 slice 3, `POST /v1/me/erasure` and `POST /v1/admin/users/{userId}/erasure`):
   - replace `users.subject` with `erased:<HMAC-SHA-256(k_erasure, issuer, subject)>`, where `k_erasure` is derived from `AUTH_LOG_SALT` with HKDF under a separate label from the log-tag key, and the input is length-prefixed;
   - set `users.erased_at`;
   - delete all role grants;
   - write an audit event `user:erase` whose details hold only the initiator (`self`, `admin` or `support`).
   - Repeating the call changes nothing.
   - Erasure is refused (409) while dependent records exist. Today that is an `admin` grant; orders will add their own blockers.
3. Keep `users.id`, so that `audit_events.actor_user_id` (ON DELETE RESTRICT, ADR-0016) stays valid but no longer resolves to a person.
4. Tokens after erasure:
   - Access tokens whose `iat` is at or before `erased_at` plus the 60 s clock tolerance are rejected with 401. The keyed hash lets the API recognise the erased subject without storing it.
   - The cost: a fresh login within about a minute of the erasure is also rejected.
   - A token issued later (only possible if the provider still or again has the account) creates a new, unlinked user with only the `customer` role.
   - Erasing that new user again re-tombstones the older record with a random value; the newer erasure takes over recognition.
   - **Recognition window:** recognition is needed only while pre-erasure tokens can still be valid: the 24 h lifetime cap plus twice the clock tolerance, fixed at 24 h 2 min regardless of the configured lifetime. After that, `forget_erased_subjects` replaces the keyed hash with a random tombstone, removing the long-term re-identification handle. It runs on every erasure, and operators schedule `db:forget-erased` daily as the owner.
   - Rotating `AUTH_LOG_SALT` ends recognition early. Rotate it only once the last erasure is older than the recognition window.
   - **Not yet enforced:** erasure is irreversible, yet any valid access token can trigger it. Once a provider is wired in, require recent authentication (`auth_time` with `max_age`) for self-service erasure.

The keyed hash is not reversible without the salt, but the row is pseudonymous, not anonymous. It is still personal data under GDPR (Art. 4(5), Recital 26), because `users.id` links audit rows, request IDs and, later, orders. Keeping it with the audit trail relies on the Art. 17(3) exemptions (legal obligation, or establishing and defending legal claims), and that basis must be documented.

Logs carry an HMAC of issuer and subject (ADR-0016). That tag can be linked back to a person until both the provider account and Tazumo's own backups holding the subject have expired. Request IDs in log lines also link to `audit_events`, and through it to the pseudonymous `users.id`. Rotating `AUTH_LOG_SALT` on a schedule, and expiring logs by retention, limits re-identification while backups still hold the account.

What differs per provider:

- **Self-hosted (Keycloak, Zitadel):**
  - We are controller and operator of the identity store, so its backups, logs and retention are ours to purge or expire.
  - Erasure must also reach database backups within the documented retention.
  - We use fewer processors, and none of them is identity-specific. The IaaS host, managed PostgreSQL and e-mail/SMS delivery remain processors.
- **SaaS (Auth0, Entra, Ory, Zitadel Cloud):**
  - The provider is a processor under a DPA.
  - Erasure goes through its management API.
  - Backup purge follows the provider's published retention, and audit logs on the provider side are theirs to retain.
  - The sub-processor lists must be reviewed.
- **Subject identifiers:**
  - Entra issues pairwise `sub` values per application. This is good for privacy, but re-registering the application changes every `sub`, so plan a migration path (or map on `oid` explicitly).
  - Keycloak, Zitadel, Auth0 and Ory issue a stable per-user `sub` by default; Keycloak can be configured for pairwise subjects.
- **Data minimisation:** whichever provider we choose, the API keeps ignoring profile claims. If profile data is ever needed (for example a display name for support), it is fetched from the provider on demand and never stored in Tazumo's database.

## Recommendation

**Self-hosted Keycloak on EU infrastructure.**
- It is the only option that combines full EU control, OIDC certification, a container for real-IdP tests in CI, no per-MAU cost and a permissive licence. Zitadel's AGPL only binds a modified Zitadel offered over a network, so running it unmodified as a separate service is also fine; self-hosted Zitadel is a close second with lighter operations.
- Its operational burden is the main downside. Nothing is deployed yet, and the only EU infrastructure the project runs today is its CI runners. A single-instance deployment with managed PostgreSQL and tested backups is enough at prototype stage, but someone has to own upgrades and on-call. If nobody can, the managed fallback below is the better choice.

**If operations capacity is not available, use a managed EU-region vendor.** Zitadel Cloud (EU region) or Ory Network (EU) keeps data in the EU with minimal operations. Their hyperscaler sub-processors carry legal exposure comparable to the US vendors, so the difference from Auth0 and Entra is smaller than residency alone suggests.

**Auth0 EU and Entra External ID are technically strong but rank lower here.** Their US parents carry legal exposure. They remain viable if legal review accepts the Data Privacy Framework and SCC route.

## Consequences if accepted

1. Run a spike:
   - Keycloak in a container locally and in `api.yml`;
   - a realm with an API audience (client scope) and access tokens with `typ` recorded;
   - token lifetime set to 5 to 15 minutes;
   - CI integration tests against the real IdP, in addition to the in-process JWKS tests.
2. Document the production deployment:
   - hosting, PostgreSQL, backups and retention;
   - upgrade cadence and an on-call owner;
   - setting `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` and `AUTH_TOKEN_TYPE` from the realm.
3. Call the provider's account-deletion API from the erasure operation, replacing the operator step.

Nothing in this ADR wires a provider. Until it is accepted, `AUTH_*` stays unset in every environment, so protected routes return 503.
