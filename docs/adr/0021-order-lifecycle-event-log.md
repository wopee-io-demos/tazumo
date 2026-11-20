# ADR-0021: Order lifecycle as a validated event log with a pure state machine

Status: Proposed
Date: 2026-11-20
Tracking: issue #84, OpenSpec `order-lifecycle`, refines ADR-0003 and ADR-0005 (items 3 and 6)

## Context

ADR-0003 forbids simulated order progress and asks for an API-owned state machine with timestamped, auditable transitions. The earlier prototype advanced its tracking page on a client timer and never changed the stored status. The contract already defines `Order.status` and `OrderEvent` (`contracts/openapi.json`). Merchant acceptance decisions come from `@tazumo/merchant-ops` (ADR-0019), roles from ADR-0016.

## Decision

1. **The event log is the source of truth.** Each order is an ordered list of events with sequence 1..n. The state is derived by `replay(events)`. A persisted status column (slice 2) is a cache that must equal the replayed state, written in the same transaction as the event and the outbox row.
2. **One pure module decides transitions.** `@tazumo/orders` has no I/O and no clock. `applyCommand(events, command, actor, at, key)` replays the log, authorizes the actor, checks the transition and returns exactly one new event. The caller supplies `at` and persists the result.
3. **Every event names its actor.**
   - Human actors use the ADR-0016 `Principal` (user ID plus database-held grants).
   - Machine actors are `system` with a source (`payment`, `acceptance`, `dispatch`, `operations`), and each command accepts only specific sources.
   - Replay validates the transition but not the actor, because grants change over time. Authorization happens once, when the command is applied.
4. **Payment and merchant acceptance stay separate** (ADR-0003). `payment_authorized` moves `payment_pending` to `confirmed`. `merchant_accepted` is recorded without changing the status; `start_preparing` requires it. Declines and auto-declines cancel a confirmed order. The decision window itself belongs to `@tazumo/merchant-ops`; this module only consumes its decided `OrderAcceptance`.
5. **Idempotency keys are scoped to one order.** A key seen before with the same canonical command and actor returns the original event. With anything else it is a conflict. Order creation keys are scoped by the API to the caller (slice 2).
6. **Reasons are codes, not text.** Events never carry free text, names or addresses. The customer projection drops actor identities, courier IDs, payment references and idempotency data.
7. **Time never advances an order.** No function reads the clock or accepts a duration. A test enforces this.

## Alternatives

| Option | Why not |
| --- | --- |
| Status column with an audit table written beside it | Two sources of truth. A missed audit write or a direct UPDATE silently diverges from history, which is exactly what ADR-0003 rules out. |
| Full event sourcing with projections and snapshots everywhere | Unnecessary at prototype scale. A per-order replay of a few dozen events is cheap. A cached status column covers list queries. |
| A state-machine library (XState or similar) | Adds a runtime dependency to web, native and API for a table of 13 transitions. Typed records plus exhaustive tests are smaller and easier to review. |
| Timer-driven or client-side progression | Fabricates progress (ADR-0003, AGENTS.md rule 5). |

## Consequences

- Slice 2 stores `order_events` (append-only, protected by triggers like `audit_events`), an `orders` cache and an outbox, and exposes `GET /v1/orders/{id}`, `GET /v1/orders/{id}/events` and `GET /v1/me/orders`.
- `audit_events` stays the record of staff reads and role changes. Order events are their own audit trail, so the two are not duplicated.
- Courier assignment, pick-up and delivery need a real dispatch integration before any event of those types is produced outside tests.
- Drift tests tie statuses to the contract, roles to the API policy and migration 0002, and acceptance and money types to `@tazumo/merchant-ops` and `@tazumo/commerce` once those packages are on `main`.
