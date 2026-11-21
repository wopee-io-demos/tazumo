# Tasks

## Slice 1: ADR and payments package
- [x] ADR-0026: Stripe in test mode (owner decision on #85), compared with Adyen and Mollie on SK/CZ/DE/AT availability, test mode, SCA/3-D Secure test cards, signed webhooks and the client-side token data flow; fees left out; alternatives listed; owner secret setup and slice-2 plan recorded.
- [x] `@tazumo/payments` port, Stripe test-mode adapter (`stripe` 23.1.0 pinned), live-key refusal, webhook verification and mapping, replay guard, provider idempotency keys, minor-unit money. Evidence: `src/stripe.test.ts`, `src/webhook.test.ts`, `src/money.test.ts`.
- [x] Negative tests: live `sk_`/`rk_` keys refused without echo; publishable and malformed keys; plain-http non-loopback endpoint; amounts above 99,999,999; bad signature and tampered body (replay guard untouched); missing and malformed headers; timestamps 301 s in the past and future; parsed body; replayed event id (no second `apply`); a failed `apply` is not recorded and the retry is applied; live-mode event and object; CZK payment against a EUR order (`currency_mismatch`) and JPY (`unsupported_currency`); raw card data as token; no secret, signature or token in errors.
- [x] Drift tests against the contract (`Money`, `CreateOrderRequest` has only `quoteId` and `paymentMethodToken`) and against @tazumo/orders (command shapes, key and reason patterns, and a webhook driving an order `payment_pending` → `confirmed` with a no-append replay). The orders tests skip with a reason until PR #105 merges; run locally against PR #105 head `0a030bf` with its `packages/orders/src` copied in temporarily: 4/4 pass (re-run after review fixes).
- [x] Adapter tests against `stripe/stripe-mock` v0.206.0 pinned by digest, locally (container `tazumo-a17-stripe-mock`, removed afterwards): 7/7 pass (create with order metadata and deterministic `Idempotency-Key` on the wire, retry key reuse, ConfirmationToken and PaymentMethod confirmation in CZK and EUR with no card fields, key reuse with other parameters → `idempotency_conflict` simulated by the recording proxy, retrieve with fixture USD refused against a EUR order, cancel with its own key, card/auth/invalid-request errors injected by the proxy map to `card_declined`/`provider_auth`/`provider_rejected` with no provider message, token or key in the error).
- [x] Guard mutation checks: removing the timestamp check, replay guard, signature comparison, key guard or live-mode check each fails at least one test.
- [x] Local checks: `pnpm typecheck` (all workspace packages incl. payments), `pnpm test` (core 11, commerce 29, address 17 + 1 skipped, contract 15), `pnpm --filter @tazumo/payments test` (33 pass, 2 skipped), `pnpm build`, `node scripts/check-runner-guard.mjs` (21 jobs, after rebase on main), `check-agent-policy.py`, `check-repo-policy.mjs`, gitleaks 8.30.1 on the new files (no leaks), `openspec validate --all --strict` (`checkout-payments` valid; `agent-board-audit`, `european-localization`, `marketplace-api-contract` already fail on main).
- [ ] `payments.yml` green on the PR head on a GitHub-hosted runner.
- [x] Independent review on 285e1d6 (fresh reviewer agent): one blocker (merge conflict with ADR-0025 index line, rebased), should-fix and nits all addressed: replay guard now records only after `apply` succeeds; orders reason regex; error-mapping tests with leak checks; cards-and-wallets MVP stated (no redirect methods); slice-2 plan cancels the PaymentIntent on failure and audits a late success as `refund_required`; loopback-only http endpoint; Stripe maximum amount; `toView` order-id UUID check; workflow actions pinned by SHA; Mollie next-gen webhook coverage stated.

## Slice 2: API (after PR #105)
- [ ] `POST /v1/orders` with `Idempotency-Key` and quote binding; webhook route with a table-backed replay guard; refuse to start with live keys.

## UI slice
- [ ] Test-mode checkout on web and native, enabled only with a test publishable key.

## Test-mode E2E
- [ ] Owner adds `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET` to a `main`-only environment; E2E against Stripe test mode, skipped (not passed) without them.
