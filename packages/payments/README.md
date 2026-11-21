# @tazumo/payments

Payment provider port and a Stripe adapter that runs in **test mode only** (ADR-0026). No real money moves, and card data never reaches Tazumo: clients collect cards with Stripe's own UI and send an opaque `ctoken_…` or `pm_…` token.

- `createStripeTestProvider({ secretKey })` refuses any key that is not `sk_test_…` or `rk_test_…`.
- `processStripeWebhook({ rawBody, signatureHeader, secret, replayGuard, apply })` verifies `Stripe-Signature` over the raw body (300 s tolerance both ways), refuses live-mode events, maps the event to the `@tazumo/orders` command (`payment_authorized` or `payment_failed`) with its idempotency key, and calls `apply` once per event id. In `apply`, call `assertPaymentMatchesOrder(outcome.amount, order.total)` and apply the command with `paymentActor`; throw on any orders `ok: false` result, so the event id is not recorded and Stripe retries. Answer 2xx for `command`, `ignored` and `duplicate`, and non-2xx for `in_flight`. The API builds its `ReplayGuard` per request from the transaction that `apply` uses.
- `pspIdempotencyKey(orderId, 'create' | 'cancel')` gives the provider idempotency key for an order.

## Tests

```sh
pnpm --filter @tazumo/payments test          # unit tests, no network
docker run -d --name tazumo-<id>-stripe-mock -p 127.0.0.1:12111:12111 \
  stripe/stripe-mock@sha256:aeb96b83e87a893d2ac005e363ac01ffa6e59a5ad85b49c155dfc9129de02e78
STRIPE_MOCK_URL=http://127.0.0.1:12111 pnpm --filter @tazumo/payments test:stripe-mock
docker rm -f tazumo-<id>-stripe-mock
```

CI runs both in `.github/workflows/payments.yml` on a GitHub-hosted runner. Webhook tests generate their signing secrets at run time, and no Stripe keys are needed.

## Test-mode secrets (added by the repository owner later)

Use a dedicated test or sandbox Stripe account, never a live business account.

| Secret | Value |
| --- | --- |
| `STRIPE_TEST_SECRET_KEY` | `rk_test_…` restricted to PaymentIntents (preferred) or `sk_test_…` |
| `STRIPE_TEST_WEBHOOK_SECRET` | `whsec_…` of the test-mode webhook endpoint |
| `STRIPE_TEST_PUBLISHABLE_KEY` | `pk_test_…`, for the UI slice |

Store them in a GitHub Actions environment (for example `stripe-test`) restricted to the `main` branch. Only `push`, `schedule` and `workflow_dispatch` jobs on `main` may use it. `pull_request` jobs, and therefore fork PRs, never get it, and `scripts/check-runner-guard.mjs` fails any `pull_request` job that references secrets. A job without the secrets reports Stripe test-mode E2E as skipped, never as passed.
