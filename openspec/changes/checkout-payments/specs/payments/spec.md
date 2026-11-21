# Payments

## ADDED Requirements

### Requirement: Test-mode provider only
The payments package SHALL construct a Stripe provider only with a test-mode secret or restricted key and SHALL refuse live-mode provider objects and events.

#### Scenario: Live key refused
- WHEN the Stripe provider is constructed with a `sk_live_` or `rk_live_` key
- THEN construction throws `live_key_refused` and the error does not contain the key

#### Scenario: Other keys refused
- WHEN the key is a publishable key, empty, partial or not a string
- THEN construction throws `invalid_key`

#### Scenario: Live-mode objects refused
- WHEN the provider returns an object, or a webhook carries an event or PaymentIntent, with `livemode` other than `false`
- THEN it is rejected with `live_mode`

### Requirement: Card data never reaches Tazumo
The payments package SHALL accept only opaque Stripe ConfirmationToken (`ctoken_`) or PaymentMethod (`pm_`) ids and SHALL keep tokens, keys and secrets out of errors.

#### Scenario: Raw card fields rejected
- WHEN `createPaymentIntent` receives a card number, a legacy `tok_` token or a card object
- THEN it rejects with `invalid_token` before any provider call

#### Scenario: Token confirms the intent
- WHEN a valid token is given
- THEN the PaymentIntent is created with `confirm: true` and the token as `confirmation_token` or `payment_method`, and no card field is sent

### Requirement: Provider idempotency
The payments package SHALL send an `Idempotency-Key` on every create and cancel, derived per order and operation.

#### Scenario: Retry reuses the key
- WHEN a PaymentIntent is created twice for the same order
- THEN both requests carry `tazumo-create-<orderId>`

#### Scenario: Reused key with other parameters
- WHEN the provider answers `idempotency_error`
- THEN the call rejects with `idempotency_conflict`

### Requirement: Verified webhooks
The payments package SHALL verify `Stripe-Signature` over the raw body within a timestamp tolerance and SHALL map PaymentIntent outcomes to @tazumo/orders commands exactly once.

#### Scenario: Succeeded payment
- WHEN a correctly signed `payment_intent.succeeded` event for a Tazumo order arrives
- THEN the outcome is `payment_authorized` with the PaymentIntent id, the order id, the amount and the idempotency key `stripe-<event id>`

#### Scenario: Failed payment
- WHEN a correctly signed `payment_intent.payment_failed` event arrives
- THEN the outcome is `payment_failed` with the decline code as reason, or `payment_failed` if the code is not a plain slug

#### Scenario: Bad signature
- WHEN the signature was made with another secret, the body was changed, or the header is missing or malformed
- THEN verification throws and the replay guard is not touched

#### Scenario: Expired or future timestamp
- WHEN the signed timestamp is more than the tolerance (default 300 seconds) before or after now
- THEN verification throws `timestamp_outside_tolerance`

#### Scenario: Parsed body
- WHEN the body is a parsed object instead of raw bytes
- THEN verification throws `payload_not_raw`

#### Scenario: Replayed event
- WHEN the same event id is delivered a second time
- THEN the outcome is `duplicate` and carries no command

### Requirement: Money in minor units
The payments package SHALL charge only the @tazumo/commerce market currencies in positive integer minor units and SHALL reject payments that do not match the order total.

#### Scenario: Unsupported currency or amount
- WHEN an intent is requested in another currency or with a zero, negative, fractional or unsafe amount
- THEN it rejects with `unsupported_currency` or `invalid_amount` before any provider call

#### Scenario: Currency mismatch
- WHEN a payment's currency differs from the order total's currency
- THEN `assertPaymentMatchesOrder` throws `currency_mismatch`, and `amount_mismatch` for a different amount
