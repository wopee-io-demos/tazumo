# Change: Europe-first interface localization

Issue: [#11](https://github.com/wopee-io-demos/tazumo/issues/11)

## Proposal
Introduce shared language vocabulary for English, Czech and German; keep language separate from brand palette and market pricing. Show EUR demo amounts formatted to the selected language without currency conversion.

## Requirements
- Language switch must not change underlying catalogue, cart items, filters or prices.
- Shared UI messages and category labels must support EN, CS and DE.
- Language-specific formatting must use Intl.NumberFormat for EUR demo prices.
- This is NOT complete European compliance, currency localization, translated merchant inventory or automatic location selection.

## Tasks
- [x] Implement shared translations and currency formatting.
- [x] Implement browser and mobile language choice.
- [x] Add unit and browser tests.
- [ ] Verify CI tests and native bundles.
- [ ] Add market-specific tax, supported currencies, fees and payments.
- [ ] Complete native-speaker review and accessibility.
