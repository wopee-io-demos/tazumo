# Merchant operations domain model (slice 1)

## Why
Issue #12. Merchant onboarding, store profiles, opening hours, delivery zones, inventory availability and order acceptance need explicit, audited rules before the API serves any merchant workflow (ADR-0005, ADR-0003). The API (#56, ADR-0016) already provides identity, roles and an append-only audit log; this slice supplies the rules it will call.

## What changes
- New workspace package `@tazumo/merchant-ops` (pure TypeScript, no I/O, no runtime dependencies), ADR-0019.
- Onboarding state machine `draft → submitted → in_review → approved | rejected → live → suspended`, with `rejected → draft` (revise) and `suspended → live` (reinstate). Every transition checks the actor's role and returns an audit entry shaped like `audit_events`.
- Store profile validation (name, slug, market, address, contact, legal entity placeholders) aligned with migration 0001.
- Opening hours in an IANA timezone with weekly intervals, overnight intervals and date exceptions; `isOpenAt`.
- Circular delivery zones with haversine distance; `checkDelivery`.
- Inventory availability (`in_stock`, `out_of_stock`, `scheduled`) and `checkOrderable`.
- Merchant order acceptance window with accept, decline and automatic decline.
- A proposed migration and route plan for `apps/api` (design.md), filed as a follow-up issue for the API owner.

## Out of scope
HTTP routes, migrations, contract changes and UI (follow-up issue). Courier assignment, ETAs, payments, menus with modifiers and real merchant data.

## Tracking
Issue #12, ADR-0019.
