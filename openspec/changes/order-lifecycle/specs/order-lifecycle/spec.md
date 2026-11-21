# Order lifecycle

## ADDED Requirements

### Requirement: Event log as the source of truth
The order module SHALL derive an order's state only by replaying its events. It SHALL reject a history whose sequence has gaps or duplicates, whose time goes backwards, whose idempotency keys repeat, or whose recorded statuses do not follow the transition table.

#### Scenario: Happy path replay
- WHEN an order is created, payment is requested and authorized, the merchant accepts, preparation starts, the order is marked ready, a courier is assigned, and the order is picked up and delivered
- THEN the events have sequence 1 to 9 with non-decreasing times, and replaying them yields status `delivered`.

#### Scenario: Tampered history
- WHEN an event's status, actor, reason or payload is changed, or an event is removed from the middle or duplicated
- THEN replay fails with `invalid_history`, and no command can be applied to that history.

### Requirement: Attributed, authorized transitions
The order module SHALL apply a command only when the actor is allowed for it: the order's customer, staff of the order's merchant, the assigned courier, support or admin, or a system source permitted for that command. It SHALL produce exactly one event that names the actor.

#### Scenario: Wrong actor
- WHEN a customer, staff of another merchant, an unassigned courier or a non-permitted system source issues a command
- THEN the result is `forbidden` and no event is produced.

#### Scenario: Revoked actor retries
- WHEN an actor whose grants were revoked, or an unrelated actor, repeats a command with a key already in the log
- THEN the result is `forbidden`, not the original event or a conflict.

#### Scenario: System command without a reason
- WHEN a system source fails an order without a reason code
- THEN the result is `reason_required` and no event is produced.

#### Scenario: Illegal transition
- WHEN a permitted actor issues a command that the current status does not allow, such as declining after acceptance or cancelling as a customer after confirmation
- THEN the result is `illegal_transition` and no event is produced.

### Requirement: Payment and merchant acceptance stay separate
The order module SHALL move to `confirmed` only on payment authorization, SHALL record merchant acceptance from a decided `@tazumo/merchant-ops` acceptance for the same order and merchant, and SHALL start preparation only after that acceptance.

#### Scenario: Inconsistent acceptance
- WHEN an acceptance is for another order or merchant, was decided after its deadline, before it was received or after the command time
- THEN the result is `acceptance_mismatch` and no event is produced.

#### Scenario: Auto-decline
- WHEN the acceptance window expired and the system applies the auto-declined acceptance
- THEN the order is `cancelled` with reason `window_expired`.

### Requirement: Idempotent commands
The order module SHALL return the original event when a command is repeated with the same idempotency key, payload and actor, and SHALL reject the key with `idempotency_conflict` when the command, payload or actor differs.

#### Scenario: Webhook retry
- WHEN the same payment authorization is delivered twice with the same key
- THEN the second call returns the first event, marked as replayed, and the log does not grow.

### Requirement: No simulated progress
The order module SHALL NOT read the clock, accept durations or derive status from elapsed time, and SHALL reject free text and unknown fields so that events carry no personal data. The customer projection SHALL contain only recorded events, with no ETA, courier identity, payment reference or idempotency data.

#### Scenario: A day passes without events
- WHEN the clock advances by 24 hours and no event is added
- THEN the replayed status and the customer timeline are unchanged.
