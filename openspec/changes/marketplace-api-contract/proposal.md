# Marketplace API contract

## Why
The three platform clients currently operate on local synthetic catalogue data. Before replacing fixtures, introduce a coherent versioned contract for cross-platform compatibility, order safety and future country expansion.

## Scope
- Market/country configuration, merchant/product discovery, authoritative price quotes and authenticated order reads.
- Payment token boundary and idempotent order creation; append-only tracking events.
- OpenAPI 3.1 draft as review artifact only, **not** working endpoints.

## Out of scope
- Deployed service, actual authentication, merchant onboarding, payment processing, production courier dispatch or migrations.

## Tracking
Issue #5, roadmap #17, ADR-0005.
