# Tasks

- [x] Migration `0005` (VAT category and override) and the seed's per-product VAT categories.
- [x] `POST /v1/order-quotes`: country-based market resolution, server-side prices, `priceBreakdown`, error mapping (404, 400, 422; server data errors give 500, logged by code only).
- [x] Synthetic distance from the postal code (SHA-256, 0 to 8,000 m), labelled in the response.
- [x] Contract `0.7.0-draft`, additive, plus contract-driven request body validation.
- [x] Tests (`test/quotes.test.ts`):
  - SK mixed basket matches the package exactly;
  - CZK cash rounding against card;
  - client prices ignored;
  - 404, 400 and 422 cases including the IE demo market;
  - unavailable items;
  - a 500 on bad server data, with no address in the logs.
- [ ] Current-head CI green and independent review recorded in the PR.
