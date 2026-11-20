# Orders, prices and tracking

## Requirements

### Requirement: Authoritative quote
The service SHALL calculate prices, tax, delivery fees, inventory and fulfilment eligibility server-side in the relevant market currency and return an expiring quote.

#### Scenario: Client proposes a different price
- WHEN a client requests a quote with product IDs and quantities
- THEN the service ignores any client-supplied product price and returns authoritative amounts and item availability.

### Requirement: Idempotent order creation
The service SHALL require authenticated identity, valid quote, opaque payment token, idempotency key and relevant authorization to create an order, and SHALL prevent duplicate orders or double charging on retried requests.

#### Scenario: Network retry after order creation
- WHEN the same authenticated client submits a create-order request with the same idempotency key
- THEN the service SHALL return the original order outcome without creating or charging a second order.

### Requirement: Authentic order updates
The service SHALL persist order status transitions as timestamped ordered events and SHALL NOT present client-side simulated progress as genuine dispatch or courier tracking.

#### Scenario: Courier has not been assigned
- WHEN an order is accepted but no courier assignment event exists
- THEN the client SHALL NOT show a named courier or fabricated live vehicle location.

### Requirement: Country-aware marketplace
The service SHALL expose market/country, ISO currency and locale information without asserting live merchant availability unless backed by operational data.

#### Scenario: Unsupported delivery area
- WHEN a customer requests delivery to an unserved zone
- THEN quoting SHALL return an explicit unavailable or ineligible result rather than a purchasable order.
