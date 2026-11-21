# Checkout payments in Stripe test mode (checkout-payments)

## Why
Issue [#85](https://github.com/wopee-io-demos/tazumo/issues/85): turn a quote into an order with a payment provider in test mode. The repository owner chose Stripe in test mode on 2026-11-21. ADR-0005 requires idempotent order creation and a payment token boundary, and ADR-0003 forbids presenting simulated payments as real.

## What changes
Slice 1 (this change so far):
- ADR-0026: Stripe in test mode, compared with Adyen and Mollie, with the data flow that keeps card data away from Tazumo.
- New package `@tazumo/payments`: provider port, Stripe test-mode adapter (pinned `stripe` SDK), live-key refusal, webhook signature verification and event mapping to `@tazumo/orders` commands, replay guard, provider idempotency keys, integer minor-unit money for the @tazumo/commerce currencies.
- New workflow `payments.yml`: unit tests and adapter tests against the official `stripe/stripe-mock` image, pinned by digest, on a GitHub-hosted runner, without any keys.

Slice 2 (after PR #105): `POST /v1/orders` and the webhook route in `apps/api`. UI slice: test-mode checkout on web and native.

## Out of scope
Real payments, payouts, refunds, chargebacks, cash on delivery, invoices, manual capture.

## Tracking
Issue #85, ADR-0026, PR #105 (order commands).
