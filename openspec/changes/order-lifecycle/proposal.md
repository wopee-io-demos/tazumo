# Order lifecycle state machine

## Why
ADR-0003 forbids simulated order progress, and the earlier prototype's timer-driven tracking must not return (#26). The contract defines order statuses and events, but nothing decides transitions. Every later order feature needs one tested authority: quotes (#83), checkout (#85), order screens (#86) and the admin overview (#93).

## What changes
- New pure package `@tazumo/orders` (no I/O, no clock):
  - `createOrder`, `applyCommand`, `replay`, `customerTimeline`;
  - statuses identical to the contract;
  - actors from ADR-0016 plus scoped `system` sources;
  - merchant acceptance consumed from `@tazumo/merchant-ops`;
  - per-order idempotency keys;
  - reason codes only.
- Drift tests against `contracts/openapi.json`, the API policy and migration 0002, and the merchant-ops and commerce packages when present.
- ADR-0021.

## Out of scope
Persistence, HTTP routes and the outbox (slice 2 of #84), courier dispatch, payments, notifications, any ETA.

## Tracking
Issue #84, ADR-0003, ADR-0005, ADR-0016, ADR-0019, ADR-0021.
