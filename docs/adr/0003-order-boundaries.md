# ADR-0003: No simulated production order fulfilment

Status: Proposed
Date: 2026-11-20

## Context
The initial prototype simulates order progress. Tazumo must not imply live courier tracking, real-time quotes or successful payment where none exists.

## Proposed decision
Use an API-owned order state machine with timestamped signed events. Separate pricing confirmation, payment authorization, merchant acceptance, courier dispatch, fulfilment and support. Design idempotent mutations, retries and auditable state transitions before production checkout.

## Consequences
Until real API, payment and courier services are integrated, checkout remains disabled. Future backend and OpenAPI contract are tracked in GitHub issue #5.
