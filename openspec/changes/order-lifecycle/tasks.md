# Tasks

- [x] ADR-0021: event log as source of truth, actor model, separation of payment and acceptance, idempotency scope, alternatives.
- [x] `@tazumo/orders`: `createOrder`, `applyCommand`, `replay`, `customerTimeline`, transition table with actor rules. Evidence: `packages/orders/src/machine.test.ts`.
- [x] Every command tested from every reachable status: allowed only from the table's statuses, otherwise `illegal_transition` (or `forbidden` for courier commands before a courier is assigned). Evidence: transition matrix tests.
- [x] Negative tests for wrong actors, missing or free-text reasons, acceptance mismatches, idempotency conflicts, invalid inputs and instants, and tampered histories.
- [x] No-timer guarantee: a fake clock advanced by 24 h leaves state unchanged, and a source scan rejects clock and timer APIs.
- [x] Drift tests: statuses and `Money` against `contracts/openapi.json`; roles against `apps/api/src/auth/policy.ts` and migration 0002; acceptance states, decline reasons and `Money` against `packages/merchant-ops` and `packages/commerce`. The sibling checks skip until those packages are on `main`; they were verified locally against the PR #76 head and the #11 work in progress (5/5 pass).
- [ ] Slice 2 (#84): migrations for `order_events`, the `orders` cache and the outbox; order read routes; staff transition routes.
