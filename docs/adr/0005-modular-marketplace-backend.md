# ADR-0005: Contract-first, modular marketplace backend

Status: Proposed. No backend is deployed.
Date: 2026-11-20

## Context

The current web and Expo apps use fixtures in `@tazumo/core`. An earlier internal prototype used Supabase and simulated order tracking. We require real pricing, identity, marketplace operations and order event provenance before enabling customer checkout.

## Proposed decision

1. Use a versioned OpenAPI 3.1 contract as the boundary between web, native apps and the backend, beginning with `contracts/openapi.json`.
2. Implement a **modular monolith** initially, with explicit domains: identity, market/locale, merchant and catalogue, availability/quotes, checkout/payment, orders, delivery dispatch and support.
3. Use **PostgreSQL** as authoritative transactional storage; evaluate PostGIS for delivery zones and distance lookups. Event and outbox records are persisted atomically with order transitions; consumers must be idempotent. Add durable queues only after a measured operational need.
4. Keep monetary quantities in **integer minor units plus ISO currency code**, with calculations and tax/fee decisions authoritative on the server. ISO market configuration governs locale, currency and permitted payment methods.
5. Require authentication and owner/role authorization for order reads/writes. No personal delivery addresses or raw payment card data in logs.
6. Separate creating an order, payment authorization, merchant acceptance and courier dispatch into explicit audited transitions. Never substitute a timer for courier tracking.
7. Prefer a simple TypeScript HTTP service initially (evaluate Fastify, NestJS and Hono against needs), not distributed microservices at prototype stage.

## Alternatives

- Supabase-only platform: fast MVP, but must assess multi-tenant role authorization and webhook/payment orchestration. Existing source credentials must never be copied.
- Microservices: deployment and consistency costs unjustified at this stage.
- GraphQL: useful for flexible discovery but not required for first versioned contract.

## Consequences and validation gates

This ADR does not approve a production stack until the service framework, database migrations, secret management, GDPR/security, observability, payments and operations are independently reviewed. Generate typed clients from OpenAPI only after validation. Track on issue #5 and OpenSpec `marketplace-api-contract`.
