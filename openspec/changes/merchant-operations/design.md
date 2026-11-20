# Design: merchant operations domain (slice 1)

Decisions and alternatives are in ADR-0019. This slice ships only `packages/merchant-ops`; the migration and routes below are a proposal for the `apps/api` owner, tracked in follow-up issue #75.

## Package layout
| Module | Exports |
| --- | --- |
| `actors.ts` | `roles` (same list as `apps/api/src/auth/policy.ts`), `Actor`, `AuditEntry`, `Result` |
| `profile.ts` | `StoreProfile`, `validateStoreProfile` |
| `onboarding.ts` | `onboardingStates`, `transitionOnboarding`, `allowedCommands`, `acceptsOrders` |
| `hours.ts` | `OpeningHours`, `validateOpeningHours`, `isOpenAt`, `localTime` |
| `delivery.ts` | `DeliveryZone`, `distanceMeters`, `checkDelivery`, `validateDeliveryZone` |
| `inventory.ts` | `Availability`, `isAvailableAt`, `checkOrderable` |
| `acceptance.ts` | `openAcceptanceWindow`, `respondToOrder`, `expireIfDue`, `declineReasons` |

All functions are pure and take the instant as an argument, so the API supplies `now()` and tests need no fake clock.

## Onboarding transitions
| Command | From | To | Allowed actors | Reason |
| --- | --- | --- | --- | --- |
| `submit` | draft | submitted | `merchant_staff` of the merchant (profile must validate) | |
| `start_review` | submitted | in_review | support, admin | |
| `approve` | in_review | approved | support, admin | |
| `reject` | in_review | rejected | support, admin | required |
| `revise` | rejected | draft | `merchant_staff` of the merchant | |
| `go_live` | approved | live | `merchant_staff` of the merchant, admin | |
| `suspend` | live | suspended | support, admin | required |
| `reinstate` | suspended | live | admin | |

The actor check runs before the state check, so a caller without rights cannot probe the state. Audit `action` values are `merchant_onboarding:<command>`, `resource_type` is `merchant`.

## Alignment with the merged schema (migrations 0001 to 0003)
- Role names and the `merchant_staff ⇔ merchant_id` rule match `user_roles` (0002); a test reads the policy module and the migration.
- `AuditEntry` maps to `audit_events (actor_user_id, action, resource_type, resource_id, details)` (0002, 0003). The API adds `request_id` and `occurred_at` may be taken from the entry or `now()`.
- Profile `name`, `slug` and `marketCode` use the `merchants` CHECK rules (0001).
- `merchants.accepting_orders` stays the merchant's own pause switch. The effective rule is `state = 'live' AND accepting_orders`.
- `products.available` stays as the discovery flag; the API keeps it in sync with `availability_status` (below) until discovery reads the new columns.
- `merchants.delivery_eta_minutes` is not touched: ETAs are out of scope.

## Proposed migration (next free number, 0004 at the time of writing)
```sql
CREATE TABLE merchant_onboarding (
  merchant_id uuid PRIMARY KEY REFERENCES merchants (id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'live', 'suspended')),
  profile jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merchant_opening_hours (
  merchant_id uuid PRIMARY KEY REFERENCES merchants (id) ON DELETE CASCADE,
  time_zone text NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  weekly jsonb NOT NULL DEFAULT '{}'::jsonb,
  exceptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merchant_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants (id) ON DELETE CASCADE,
  center_lat double precision NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
  center_lng double precision NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
  radius_meters integer NOT NULL CHECK (radius_meters BETWEEN 1 AND 50000)
);
CREATE INDEX merchant_delivery_zones_merchant_id_idx ON merchant_delivery_zones (merchant_id);

ALTER TABLE products
  ADD COLUMN availability_status text NOT NULL DEFAULT 'out_of_stock'
    CHECK (availability_status IN ('in_stock', 'out_of_stock', 'scheduled')),
  ADD COLUMN available_from timestamptz,
  ADD COLUMN available_until timestamptz,
  ADD CHECK ((availability_status = 'scheduled') = (available_from IS NOT NULL)),
  ADD CHECK (available_until IS NULL OR available_until > available_from);
UPDATE products SET availability_status = 'in_stock' WHERE available;

CREATE TABLE merchant_order_acceptances (
  order_id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES merchants (id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('pending', 'accepted', 'declined', 'auto_declined')),
  received_at timestamptz NOT NULL,
  deadline timestamptz NOT NULL CHECK (deadline > received_at),
  decided_at timestamptz,
  decline_reason text CHECK (decline_reason IN ('out_of_stock', 'too_busy', 'closing_soon', 'other', 'window_expired')),
  CHECK ((state = 'pending') = (decided_at IS NULL))
);
CREATE INDEX merchant_order_acceptances_due_idx ON merchant_order_acceptances (deadline) WHERE state = 'pending';

ALTER TABLE audit_events
  ADD COLUMN actor_kind text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user', 'system')),
  ALTER COLUMN actor_user_id DROP NOT NULL,
  ADD CHECK ((actor_kind = 'user') = (actor_user_id IS NOT NULL));
```
- `order_id` gets a foreign key once an `orders` table exists.
- Runtime grants for `tazumo_api`: SELECT, INSERT, UPDATE on the new tables; UPDATE on the three new `products` columns only; no DELETE on `merchant_onboarding` or `merchant_order_acceptances`.
- Concurrency: transitions use `UPDATE ... WHERE merchant_id = $1 AND version = $2`, and a lost race returns 409.
- Down migration drops the tables and columns; the `audit_events` change is reversible only while no system rows exist, so the down step must refuse if any exist.

## Proposed routes (contract `0.5.0-draft`, additive)
| Operation | Auth | Domain call | Notes |
| --- | --- | --- | --- |
| `GET /v1/merchants/{merchantId}/onboarding` | own staff; support, admin (audited) | none | state, profile, `allowedCommands` |
| `PUT /v1/merchants/{merchantId}/onboarding/profile` | own staff, only in `draft` | `validateStoreProfile` | 422 with field paths |
| `POST /v1/merchants/{merchantId}/onboarding/transitions` | per transition table | `transitionOnboarding` | body `{ command, reason?, version }`; 409 `illegal_transition` or version conflict; 422 `reason_required`/`invalid_profile`; 403/404 as ADR-0016 |
| `PUT /v1/merchants/{merchantId}/opening-hours` | own staff, admin | `validateOpeningHours` | |
| `PUT /v1/merchants/{merchantId}/delivery-zones` | own staff, admin | `validateDeliveryZone` | replaces the set |
| `POST /v1/merchants/{merchantId}/delivery-check` | anonymous | `checkDelivery` | coordinates in the body, never logged |
| `PATCH /v1/merchants/{merchantId}/products/{productId}/availability` | own staff | `validateAvailability` | keeps `products.available` in sync |
| `POST /v1/merchants/{merchantId}/orders/{orderId}/acceptance` | own staff | `respondToOrder` | waits for the orders domain |

- New policy actions in `can()`: `merchant_onboarding:read`, `merchant_onboarding:transition`, `merchant_settings:write`, `merchant_inventory:write`, `merchant_order:respond`. The domain repeats the role rule, so a missing policy call still cannot run a transition.
- Every write stores the new row and its audit entry in one transaction.
- Auto-decline sweeper: a periodic job selects due rows with `FOR UPDATE SKIP LOCKED`, calls `expireIfDue` and writes system audit rows. Until the `audit_events` change lands, auto-declines must not be persisted.

## Testing approach
Unit tests under `node --test` with fixed instants: every transition and refusal, profile field errors, DST spring-forward and fall-back in Europe/Bratislava and Europe/Berlin, overnight intervals and exceptions, haversine reference distances and the inclusive radius, availability windows, and the acceptance window boundaries. A drift test compares role names with `apps/api`.
