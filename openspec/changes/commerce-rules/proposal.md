# Market, VAT and fee rules (commerce-rules)

## Why
Issue [#11](https://github.com/wopee-io-demos/tazumo/issues/11), acceptance item "Country tax/delivery fee API and checkout transparency". ADR-0005 makes pricing, tax and fee decisions server-authoritative in integer minor units, but no code computes VAT, fees or payable totals, and the apps only format fixture prices in EUR.

## What changes
- New pure TypeScript package `@tazumo/commerce` (no I/O, no UI, no dependencies).
- Market configuration for SK, CZ, DE and AT: currency, locale, VAT rates by category with cited sources, VAT-inclusive display, CZK whole-crown payable rounding.
- `priceBreakdown(market, order)`: lines, subtotal, synthetic delivery fee (base plus distance band), synthetic small-order surcharge, VAT per rate, total, rounding and payable amount, each with an explanation.
- Typed `CommerceRuleError` codes for invalid input.
- ADR-0018 records the design, VAT sources with retrieval dates and the classification assumptions to re-verify.
- The root `test` script runs the package tests.

## Out of scope
HTTP endpoints and contract changes (follow-up for the API owner), UI, payments, real fees, effective-dated rates, alcohol, deposits, vouchers and B2B reverse charge.

## Tracking
Issue #11, ADR-0018.
