# Merchant operations

## ADDED Requirements

### Requirement: Audited onboarding state machine
The domain SHALL move a merchant only through these transitions: submit (draft to submitted, staff of that merchant), start review (submitted to in review, support or admin), approve (in review to approved, support or admin), reject (in review to rejected, support or admin, reason required), revise (rejected to draft, staff of that merchant), go live (approved to live, staff of that merchant or admin), suspend (live to suspended, support or admin, reason required) and reinstate (suspended to live, admin). The actor is a principal with the database grants of ADR-0016; the first grant that satisfies the rule is the audited actor role. Reasons SHALL be at most 500 characters and instants SHALL carry `Z` or an explicit UTC offset. Each successful transition SHALL return exactly one audit entry with the actor user, actor role, previous state, new state and any reason. Refused commands SHALL return an error code and no audit entry.

#### Scenario: Full onboarding path
- WHEN staff submit a valid draft, support starts the review, admin approves and staff go live
- THEN the merchant is live and four audit entries record each actor, role and state change.

#### Scenario: Illegal transition
- WHEN an allowed role issues a command that does not start from the merchant's current state, such as approve on a draft
- THEN the result is `illegal_transition` and no audit entry is produced.

#### Scenario: Wrong actor
- WHEN a customer, a courier, staff of another merchant, or a role outside the rule issues a command
- THEN the result is `forbidden`, checked before the state so the current state is not revealed.

#### Scenario: Missing reason or invalid profile
- WHEN reject or suspend is issued without a non-blank reason, or submit is issued with an invalid store profile
- THEN the result is `reason_required` or `invalid_profile` with the failing field paths.

### Requirement: Store profile validation
The domain SHALL validate a store profile's name (1 to 200 characters), slug and market code (`^[a-z0-9-]{1,64}$`), address, contact e-mail and E.164 phone, and legal entity placeholders, and SHALL report every invalid field by path.

#### Scenario: Several invalid fields
- WHEN a profile has a blank name, an upper-case slug and a phone number without a country code
- THEN each of `name`, `slug` and `contact.phone` is reported.

### Requirement: Opening hours across daylight saving time
The domain SHALL evaluate opening hours as local wall-clock intervals in the merchant's IANA timezone, including overnight intervals and date exceptions that replace the weekly hours for that date. Hours that fail validation SHALL be treated as closed.

#### Scenario: Spring forward
- WHEN a Europe/Bratislava or Europe/Berlin store is open 01:00 to 03:00 on 29 March 2026
- THEN it is open from 00:00 to 01:00 UTC only, because local 02:00 to 03:00 does not occur.

#### Scenario: Fall back
- WHEN the same store is open 01:00 to 03:00 on 25 October 2026
- THEN it is open from 23:00 UTC on 24 October to 02:00 UTC, covering both occurrences of local 02:00 to 03:00.

#### Scenario: Holiday exception
- WHEN an exception closes the store on 24 December
- THEN it is closed that day, while a weekly overnight interval from 23 December still ends at its normal time.

#### Scenario: Invalid configuration
- WHEN the timezone is unknown, a time is malformed (such as `25:00` or an opening at `24:00`) or the weekly table is missing
- THEN validation reports the path and `isOpenAt` returns closed.

### Requirement: Delivery zone check
The domain SHALL compute great-circle distance with the haversine formula and SHALL treat a destination as deliverable when it lies within the radius (inclusive) of at least one valid zone of at most 50 km.

#### Scenario: Outside every zone
- WHEN the destination is farther than every zone's radius, or its coordinates are out of range
- THEN the result is `outside_zone` or `invalid_destination`.

### Requirement: Inventory availability and orderability
The domain SHALL treat items as available when in stock, or when scheduled and the instant lies in `[from, until)`. An item SHALL be orderable only when the merchant is live, has not paused order taking (`merchants.accepting_orders`), is open and the item is available.

#### Scenario: Suspended merchant
- WHEN a suspended merchant's in-stock item is checked during opening hours
- THEN the result is `merchant_not_live`.

#### Scenario: Paused merchant
- WHEN a live merchant has paused order taking
- THEN the result is `merchant_paused`.

### Requirement: Merchant order acceptance window
The domain SHALL open an acceptance window of 1 to 30 minutes for each order. Only staff of the order's merchant SHALL accept or decline (with a reason code) before the deadline. At or after the deadline, or when the stored deadline is not a valid instant, a pending order SHALL be declined automatically by the system actor. Each decision SHALL return one audit entry.

#### Scenario: Late response
- WHEN staff respond at or after the deadline
- THEN the result is `window_expired`, and expiring the window records an `auto_decline` audit entry with no user actor.

#### Scenario: Wrong responder or repeated decision
- WHEN staff of another merchant, support or admin respond, the decision is neither accept nor decline, or a decided order is answered again
- THEN the result is `forbidden`, `invalid_decision` or `already_decided`.
