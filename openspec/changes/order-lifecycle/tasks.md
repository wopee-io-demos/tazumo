# Tasks

- [x] ADR-0021: event log as source of truth, actor model, separation of payment and acceptance, idempotency scope, alternatives.
- [x] `@tazumo/orders`: `createOrder`, `applyCommand`, `replay`, `customerTimeline`, transition table with actor rules. Evidence: `packages/orders/src/machine.test.ts`.
- [x] Every command tested from every reachable status: allowed only from the table's statuses, otherwise `illegal_transition` (or `forbidden` for courier commands before a courier is assigned). Evidence: transition matrix tests.
- [x] Negative tests for wrong actors, missing or free-text reasons, acceptance mismatches, idempotency conflicts, invalid inputs and instants, and tampered histories.
- [x] No-timer guarantee: a fake clock advanced by 24 h leaves state unchanged, and a source scan rejects clock and timer APIs.
- [x] Drift tests: statuses and `Money` against `contracts/openapi.json`; roles against `apps/api/src/auth/policy.ts` and migration 0002; acceptance states, decline reasons and `Money` against `packages/merchant-ops` and `packages/commerce`. The sibling checks skip until those packages are on `main`; they were verified locally against the PR #76 head and the #11 work in progress (5/5 pass).
- [x] Review round 1 fixes: fingerprint from the normalised command and strict fields (no free text in events); authorization before the idempotency lookup; acceptance time and deadline consistency; replay checks actor, reason and payload per event type; frozen tables; case-insensitive ID matching. Evidence: new tests in `machine.test.ts`.
- [x] Review round 2 (reviewer agent on `328b1a0`, verdict: approve once S1 and S2 are fixed): replay enforces each actor rule's prior statuses (S1); conflict test for a different support user (S2); strict acceptance `state` (N2). Fixed in `cb3bc29`.
- [x] Orchestrator review of `328b1a0` (no blockers):
  - S1: actor status limits in replay;
  - S2: exact top-level, actor and data keys per event type, and a reason only where required;
  - S3: `confirmedAt <= acceptanceDecidedAt <= occurredAt` in replay;
  - S4: tests for a conflict between two support users, a last-event status tamper, `courierUserId` 'bob', a cancel without its reason, a cancel attributed to another customer, and a malformed `acceptanceDecidedAt`;
  - S5: ADR-0021 actor-replay wording rewritten;
  - S6: UUID-only, lowercased user IDs.
  - Nits: N2 decline reason refused on accept, N3 `confirmedAt` tracked and acceptance compared to it, N4 hour 24 rejected, N7 customer-safe reasons in `customerTimeline`.
  Evidence: `machine.test.ts` (36 pass, 1 skipped).
- [ ] After PR #76 merges: switch from the source-regex drift check to a type import of `OrderAcceptance`, and import it instead of the local `AcceptanceDecision`. (`@tazumo/commerce` merged in #80; its `Money` drift check now runs and passes.)
- [ ] Slice 2 (#84): use `(order_id, sequence)` as the event primary key (orchestrator N6).
- [ ] Slice 2 (#84): migrations for `order_events`, the `orders` cache and the outbox; order read routes; staff transition routes.
