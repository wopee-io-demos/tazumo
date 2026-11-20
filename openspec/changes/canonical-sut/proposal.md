# Tazumo canonical SUT change

Issue #32. Supply a stable test surface on web and native clients without coupling demo tests to CSS or localized visible labels.

## Requirements
- Stable named UI automation identifiers for search, category, product, add-to-cart, cart, locale and palette on web and native platforms.
- Shared fixture IDs and expected synthetic behavior. Invalid or unavailable checkout actions are never represented as real transactions.
- Changes to identifier contract must bump schema version and update four demo repositories.

## Acceptance
- [x] Declare v0.1 SUT contract and stable selectors.
- [x] Expose matching identifiers in web and native React clients.
- [x] Add web E2E assertion for canonical selectors.
- [ ] Confirm latest GitHub Actions build/tests green and install native build on devices.
- [ ] Cross-repository integration and end-to-end live demo runs.
