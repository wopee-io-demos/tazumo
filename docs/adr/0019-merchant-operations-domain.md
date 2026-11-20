# ADR-0019: Merchant operations as a pure domain package

Status: Proposed
Date: 2026-11-20
Tracking: issue #12, OpenSpec `merchant-operations`, builds on ADR-0005 and ADR-0016

## Context

Issue #12 needs merchant onboarding, store profiles, opening hours, delivery zones, inventory availability and order acceptance. `apps/api` owns HTTP routes, migrations and the policy module, and is under active change by another agent. The rules themselves (which transition is legal, whether a store is open at an instant, whether an address is in range) do not depend on HTTP or PostgreSQL, and the web and native apps will later want the same answers for previews.

## Decision

1. **A separate workspace package, `@tazumo/merchant-ops`**, exporting `.ts` sources like `@tazumo/core` (type stripping, no build step). It has no runtime dependencies and performs no I/O. `apps/api` imports it and persists the results.
2. **Transitions return the next value plus an audit entry; they never write.** Each successful command returns `{ ok, value, audit }`, where `audit` has the shape of `audit_events` (actor, action, resource type and ID, `details` with actor role, from, to and reason). The API writes the new state and the audit row in one transaction and adds `request_id`. Refusals return an error code and no audit entry.
3. **Roles are the database roles from ADR-0016** (`merchant_staff` scoped by `merchantId`, `support`, `admin`). Customers and couriers can run no merchant-operations command. A test reads `apps/api/src/auth/policy.ts` and migration 0002 so the lists cannot drift.
4. **Opening hours use wall-clock local times in an IANA timezone, evaluated with `Intl.DateTimeFormat`.** A local time skipped by a spring-forward change never occurs; in a fall-back overlap both occurrences of a local time behave the same. Date exceptions replace that day's weekly intervals.
5. **Delivery zones are circles checked with the haversine formula** (mean Earth radius 6,371,008.8 m, radius inclusive, at most 50 km).
6. **Automatic order declines are made by a system actor** (`actorUserId: null`, `actorRole: system`). Because `audit_events.actor_user_id` is `NOT NULL`, the OpenSpec design proposes a migration that adds `actor_kind` and allows a null actor only for `system`.

## Alternatives

| Option | Why not (for now) |
| --- | --- |
| Put the logic in `packages/core` | Core holds catalogue and cart fixtures used by both apps; merchant operations is a separate domain in ADR-0005's modular monolith, and keeping it apart avoids coupling the apps' fixture package to staff workflows. |
| Put the logic inside `apps/api` | Ties pure rules to Fastify and PostgreSQL test setup, and collides with the API owner's active work. Wiring stays in `apps/api` (follow-up issue). |
| Domain writes audit rows itself | Needs a database handle in the domain and breaks the single-transaction rule the API already follows for role grants. |
| Luxon, date-fns-tz or a Temporal polyfill for time zones | A runtime dependency for one conversion that `Intl` already does with the platform's ICU data. Revisit when native `Temporal` is available in all target runtimes. |
| PostGIS for delivery checks | ADR-0005 keeps PostGIS under evaluation. A single-merchant check needs no index; PostGIS becomes useful for "which merchants deliver here" discovery queries, which can use the same radius rule. |
| A synthetic "system" user row for auto-declines | Pretends a person acted and makes system actions indistinguishable in queries. An explicit `actor_kind` is clearer for audits. |
| Polygon delivery zones | More realistic, but needs a polygon store and editor. Circles cover the demo and the type can grow a `kind` field later. |

## Consequences

- The API can wire the rules without re-deriving them; the domain is covered by fast unit tests that run in `pnpm test`.
- Opening-hour answers depend on the runtime's time zone data (Node ships full ICU). A tz database update can change answers for future dates in zones whose rules change.
- The proposed schema change to `audit_events` belongs to the API owner and is tracked in the follow-up issue; until then the API must not persist auto-declines.
- No courier assignment, ETA, payment or real merchant data is introduced. Fixtures stay synthetic.
