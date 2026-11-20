# ADR-0018: Pure commerce rules package for market, VAT and fee calculation

Status: Proposed
Date: 2026-11-20
Tracking: issue #11, OpenSpec `commerce-rules`, builds on ADR-0005 (integer minor units, server-authoritative pricing) and ADR-0003 (no simulated fulfilment presented as real)

## Context

Checkout must show customers exactly what they pay and why: item subtotal, VAT per rate, delivery fee, any surcharge and the total. ADR-0005 makes the server authoritative for these numbers. Today the apps only format fixture prices in EUR (`@tazumo/core`), and the API stores `price_minor` plus currency but has no tax or fee logic. Launch markets differ in currency (EUR versus CZK), VAT rates and category classification, and cash-rounding conventions.

## Decision

1. A new workspace package `@tazumo/commerce`, pure TypeScript with no I/O, no dependencies and no UI. It holds market configuration and one entry point, `priceBreakdown(market, order)`. The API (later) and tests call it; the apps never compute payable totals themselves.
2. **Money:** integer minor units plus ISO 4217 code, the same shape as the OpenAPI `Money` schema. Internal arithmetic uses `BigInt`; any result outside `Number.MAX_SAFE_INTEGER` is rejected (`amount_overflow`), never rounded silently.
3. **Markets:** SK, CZ, DE and AT. Each defines currency, locale, VAT rates in basis points, a default rate per VAT category (`food` = prepared meals for delivery, `groceries`, `flowers`, `gifts`, `electronics`), the rate for platform fees, payable rounding and display rules. All four show consumer prices VAT-inclusive (EU Price Indication Directive 98/6/EC); a VAT-exclusive configuration is supported and tested for future B2B use.
4. **Category defaults plus restricted overrides:** a line may name another rate (`vatRateId`) only if the market lists it as an allowed override for that category (`categoryOverrides`): AT `groceries` → 4.9 % (Annex 3 basic foods), SK `groceries` → 5 % (basic foods) or 23 %, SK `food` → 23 %. Anything else is rejected, so 4.9 % can never apply to electronics or prepared meals. Product-level tax classification belongs to the catalogue, not to this package.
5. **VAT calculation:** amounts are grouped by rate, then the VAT amount is computed once per rate and rounded half up (inclusive: `vat = round(gross × bp / (10000 + bp))`, `net = gross − vat`; exclusive: `vat = round(net × bp / 10000)`, `gross = net + vat`). Rounding the tax amount, not the net, means an exact half rounds the VAT up. Rounding per rate rather than per line matches invoice practice and avoids accumulating per-line rounding error.
6. **Fees are synthetic and labelled so in data and output:** delivery fee = base + distance band (bands inclusive at the upper bound, beyond the last band → `outside_delivery_area`); small-order surcharge = the gap to a threshold, capped. Fees are taxed at the market's standard rate as a platform service.
7. **Rounding:** CZK payable totals round half up to whole crowns (`payableIncrementMinor: 100`), shown as a separate `rounding` component that is not subject to VAT. Whole-crown amounts display without halers; amounts that are not whole crowns (VAT) keep two decimals. EUR is never rounded.
8. **Transparency:** the result lists `components` in display order, each with an English explanation and a `synthetic` flag, always ending with `payable`. Components with `addsToPayable` sum to `payableMinor`; VAT contained in inclusive prices is shown but not added. `dataStatus` carries the re-verify flag, retrieval date and a notice for the UI.
9. **Errors:** invalid input, including non-object input and more than 100 lines (`too_many_lines`), throws `CommerceRuleError` with a stable `code` (`invalid_quantity`, `currency_mismatch`, `unknown_vat_rate`, …). The API maps client mistakes to 400/422 and server-data errors to 500 (see the OpenSpec design).

### VAT rates (research data, retrieved 2026-11-20, re-verify before real use)

| Market | Standard | Reduced rates used | Category defaults (food, groceries, flowers, gifts, electronics) |
| --- | --- | --- | --- |
| SK | 23 % | 19 % listed foods; 5 % (`reduced5`) listed basic foods and meals served in catering | 19, 19, 23, 23, 23 |
| CZ | 21 % | 12 % food and catering | 12, 12, 21, 21, 21 |
| DE | 19 % | 7 % Anlage 2 goods (food, cut flowers) and restaurant food | 7, 7, 7, 19, 19 |
| AT | 20 % | 10 % Anlage 1 food and restaurant sales; 13 % Anlage 2 (cut flowers); 4.9 % Anlage 3 basic foods (opt-in per line) | 10, 10, 13, 20, 20 |

Sources, all retrieved 2026-11-20:

- EU overview, cited for every rate it lists: [Your Europe, VAT rates applied in EU countries](https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm) (page "last checked 13/07/2026"; it does not list Austria's 4.9 % rate, so that rate cites only Austrian sources).
- SK: [Finančná správa, DPH, Sadzba dane, Všeobecné informácie](https://podpora.financnasprava.sk/525847-V%C5%A1eobecn%C3%A9-inform%C3%A1cie): 23 %, 19 % for listed foods, 5 % for listed basic foods and meals served in restaurant and catering services.
- CZ: [GFŘ, Informace ke změnám sazeb DPH od 1. 1. 2024](https://financnisprava.gov.cz/assets/cs/prilohy/d-seznam-dani/Informace_GFR_ke_zmenam_sazeb_DPH_od_1_1_2024.pdf): single reduced rate 12 %, standard 21 %, cut flowers moved to the standard rate.
- DE: [UStG § 12](https://www.gesetze-im-internet.de/ustg_1980/__12.html) (19 %, 7 % for Anlage 2 goods, Abs. 2 Nr. 15 restaurant food without a sunset date) and [UStG Anlage 2](https://www.gesetze-im-internet.de/ustg_1980/anlage_2.html) (item 8, fresh cut flowers).
- AT: [RIS, UStG 1994 § 10, version from 1 July 2026](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Paragraf=10), [RIS, UStG 1994 Anlage 2](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Anlage=2) (Z 4, cut flowers at 13 %) and [USP, Neuer Umsatzsteuersatz von 4,9 Prozent](https://www.usp.gv.at/aktuelles/newsliste/neuer_ustsatz.html).

Classification assumptions to re-verify with a tax adviser before any real checkout:

- **Delivered prepared meals** are treated as a supply of goods (food), not a restaurant service. In SK this means 19 % rather than the 5 % catering rate. The 19 % figure for delivered meals rests on secondary reporting, not on a primary Finančná správa text. **Unverified:** secondary reports say that from 1 January 2026 SK moved some sugary and salty foods to 23 % (guidance 1/DPH/2026/IM, not retrieved; the cited Finančná správa page says nothing about 2026). Such products would need the allowed `vatRateId: 'standard'` override, and the SK `food`/`groceries` defaults may need to change once the guidance is read.
- **Groceries** default to the general food rate. SK basic foods (5 %) and AT Annex 3 foods (4.9 %) need per-product overrides; AT 4.9 % does not apply to mixed supplies.
- **Platform fees** (delivery, surcharge) are taxed at the standard rate as the platform's own service. If the merchant supplies delivery as an ancillary service, the rate would follow the goods and need apportionment.
- **CZK rounding difference** is excluded from the VAT base.
- Alcohol, tobacco, deposits (SK/AT/DE/CZ bottle deposits), vouchers, tips and reverse charge are not modelled.

## Alternatives considered

| Option | Why not now |
| --- | --- |
| Put the rules in `apps/api` directly | Couples pure tax maths to Fastify and PostgreSQL and makes it untestable without a database; A1 is active in `apps/api`. The package can be imported by the API unchanged. |
| Extend `@tazumo/core` | Core holds fixture catalogue and UI localization shared with the apps; adding server-authoritative pricing there invites clients to compute totals themselves. A2 is also changing it. |
| Store rates in PostgreSQL tables now | Right for production (rates change by date), but premature before the API exposes pricing. Typed constants with sources are reviewable in a PR; the config shape maps onto a table later. |
| External tax engine (Avalara, Stripe Tax, Vertex) | Paid, needs credentials and real merchant data; overkill for a demonstrative MVP. Revisit before real payments. |
| Per-line VAT rounding | Accumulates rounding error across lines; per-rate rounding is the common invoice convention. |
| Floating-point maths or decimal libraries | Floats are wrong for money; integer and `BigInt` arithmetic covers the needed operations without a dependency. |
| Banker's rounding (half to even) | Half up is the convention in the four markets' invoicing practice and is easier to explain on a receipt. |

## Consequences

- Rates are effective-date sensitive. The configuration has no validity periods yet; adding `validFrom`/`validTo` is required before rates move to the database.
- The UI must show the explanation strings, or its own translations keyed by component `kind`, and must not present fees as real while `synthetic` is true.
- `apps/api` will consume the package in a follow-up owned by the API owner (OpenSpec `commerce-rules` design): implement the existing `POST /v1/order-quotes`, resolve the commerce market from the market row's `countryCode` (the seeded `demo-eu`/IE market has no configuration and gets 422), load server-side prices and VAT categories (never trust client prices), call `priceBreakdown`, and extend `Quote` additively with `total` = payable amount and `tax` contained in the total.
