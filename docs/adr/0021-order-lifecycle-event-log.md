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
   - Grants change over time, so replay does not re-check grants. It does check that the recorded actor kind, role or source may produce that event from the prior status, and that it is the order's customer, the order's merchant or the assigned courier where the rule requires it (item 10).
   - User IDs are the lowercase UUIDs of `users.id`; other principals are refused.
4. **Payment and merchant acceptance stay separate** (ADR-0003). `payment_authorized` moves `payment_pending` to `confirmed`. `merchant_accepted` is recorded without changing the status; `start_preparing` requires it. Declines and auto-declines cancel a confirmed order. The decision window itself belongs to `@tazumo/merchant-ops`; this module only consumes its decided `OrderAcceptance`.
5. **Idempotency keys are scoped to one order.** A key seen before with the same canonical command and actor returns the original event. With anything else it is a conflict. Order creation keys are scoped by the API to the caller (slice 2).
6. **Reasons are codes, not text.** Events never carry free text, names or addresses. A reason appears only on the event types that require one. The customer projection drops actor identities, courier IDs, payment references and idempotency data, and maps internal reason codes to a fixed customer-safe set (`customerReasons`).
7. **Time never advances an order.** No function reads the clock or accepts a duration. A test enforces this.
8. **Authorization comes before idempotency.** The actor's identity for the command (ignoring the current status) is checked first, then the idempotency key, then the transition. A revoked or unrelated actor gets `forbidden` even with a known key, so it learns nothing about the order. A replayed command returns the current state, not the state at that event.
9. **Inputs are strict JSON values.** Unknown fields in commands, acceptances, money and creation input are rejected. The fingerprint is built from the normalised, validated command, so no free text reaches an event.
10. **Replay checks more than transitions.** Every event must have exactly the allowed top-level, actor and data keys for its type. For each event type it also checks:
    - which actor kind, role or source may produce it, and that it is the order's customer, the order's merchant or the assigned courier where relevant (identity does not change over time, unlike grants);
    - reason codes;
    - the payload: payment reference, courier ID, and an acceptance time between the order's confirmation (`confirmedAt`) and the event time.
    Replay cannot detect events cut off the end of a log, so slice 2 compares the replayed sequence with the cached `orders.sequence`.
11. **An acceptance must be consistent.**
    - `receivedAt` must not precede the order's confirmation, and `decidedAt` must fall between `receivedAt` and the command time.
    - Accepts must come before the deadline without a decline reason; declines before the deadline; auto-declines at or after it, with reason `window_expired`.
    - Slice 2 must load the acceptance from the merchant-operations store, never from a request body.

## Trust boundaries and deviations

- **Signed events:** ADR-0003 asks for signed events. This slice does not sign or hash-chain events. Integrity in slice 2 comes from an append-only `order_events` table (triggers rejecting UPDATE, DELETE and TRUNCATE, as for `audit_events`), a unique `(order_id, sequence)` and a runtime role without UPDATE. A per-event `prevHash` chain was considered and deferred until events leave the database (outbox consumers, exports). This is a recorded deviation from ADR-0003.
- **Price:** `createOrder` takes the total from its caller. The checkout (#85) must pass the total of a server-side quote (#83), never a client value.
- **System actors:** only server code that has verified its trigger may construct a `system` actor, for example a payment webhook with a checked signature or the acceptance sweeper. No HTTP request body may choose a system source.
- **Mapping to ADR-0016:**
  - `forbidden` maps to 404 for customers and couriers and to 403 for staff.
  - `can()` keeps deciding reads; this module authorizes mutations.
  - The three role checks (`can()`, merchant-ops `matchingRole`, this module) share the role list through drift tests and should converge on one shared policy package when slice 2 lands.
- **Payment race:**
  - A customer can cancel in `payment_pending`; a later `payment_authorized` is then illegal.
  - The webhook handler must void the authorization and must not retry the command.
  - Courier reassignment does not exist yet; a courier dropping out needs a dispatch design.
- **Contract:** `OrderEvent` in the contract has no `status` or `reason`. Slice 2 needs an additive contract change to serve the customer timeline.
- **Instants:** only normalised ISO 8601 instants with hours 00 to 23 are accepted; replayed events must hold the normalised UTC form.
- **Event IDs:** the default ID generator is `crypto.randomUUID()`. A React Native caller must pass `newId`.

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
