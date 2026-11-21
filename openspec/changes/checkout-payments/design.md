# Design

See ADR-0026 for the provider choice, data flow and alternatives.

## Package boundaries
- `port.ts`: `PaymentProvider` with `createPaymentIntent`, `retrievePaymentIntent`, `cancelPaymentIntent`, returning `PaymentIntentView` (`id`, `status`, `amount`, `orderId`, `clientSecret`). `apps/api` depends on this, not on Stripe types.
- `stripe.ts`: the only module importing the `stripe` SDK. Test-mode key guard at construction; SDK errors mapped to `PaymentError` codes without provider messages.
- `webhook.ts`: signature verification over raw bytes, event mapping and `ReplayGuard`. It does not import the SDK.
- `money.ts`, `idempotency.ts`: minor-unit conversion and key formats shared with @tazumo/orders.

## Error mapping for slice 2
| `PaymentError` code | HTTP |
| --- | --- |
| `signature_missing`, `signature_malformed`, `signature_mismatch`, `timestamp_outside_tolerance`, `payload_not_raw`, `payload_invalid` | 400 on the webhook, no state change |
| `live_mode`, `missing_order_reference`, `unsupported_currency`, `currency_mismatch`, `amount_mismatch` | 400 on the webhook, logged by code only |
| `invalid_token` | 422 on `POST /v1/orders` |
| `card_declined` | 402 problem response, order goes to `failed` through the webhook |
| `idempotency_conflict` | 422 |
| `provider_unavailable`, `provider_auth`, `invalid_provider_response` | 503 |
| `live_key_refused`, `invalid_key`, `invalid_webhook_secret` | refuse to start |

## Slice 2 plan
`POST /v1/orders` per the API conventions on #75: `routeSchema('post', '/v1/orders')`, `authenticated` rate-limit tier, a new `can()` action, audit event in the same transaction, the next free migration with grants to `tazumo_api`, `429`/`401`/`503` responses and a contract minor bump. `Idempotency-Key` is required (missing → 400, same key with a different body → 422, same key and body → original order). The quote must belong to the caller, be unexpired and unused (otherwise 409). The order goes `created` → `payment_pending` and the PaymentIntent is created with `pspIdempotencyKey(orderId, 'create')`. The webhook route reads the raw body, uses a table-backed `ReplayGuard` in the same transaction as `applyCommand`, and checks `assertPaymentMatchesOrder` against the stored total.
