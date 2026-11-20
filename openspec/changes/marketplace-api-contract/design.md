# API contract design

Keep transport models independent of React/Expo rendering. Money is explicit `{currency,minorUnits}`; each market has country and locale. Client-provided prices are never accepted. A quote expires, captures delivery address eligibility and lists subtotal, delivery fees, taxes, total and unavailable items.

Order creation requires an authenticated caller, a quote ID, an opaque provider payment token and an `Idempotency-Key`. Retries must not produce duplicate orders or captures. Payment, merchant acceptance, preparation, courier assignment, pickup and delivery are persisted events, not synthesized client timers.

Use a modular monolith with transactional outbox and event sequence to simplify consistency and enable future integrations. Use strict request validation, per-role authorization, rate limits, auditable events, PII minimization and observability before production.

The OpenAPI `servers` URL uses reserved `.invalid` intentionally because **no backend exists**.
