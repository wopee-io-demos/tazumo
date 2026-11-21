# Proposal: Native shopping navigation

Tracking issue: [#4](https://github.com/wopee-io-demos/tazumo/issues/4). Decision: [ADR-0013](../../../docs/adr/0013-native-in-app-navigation.md).

## Why
The Expo app showed the whole catalogue and a small inline basket on one scrolling screen. A native shopper and a native test agent both need distinct screens: a product detail page and a full cart where quantities can be changed and lines removed.

## What changes
- Catalogue rows open a product detail screen. The detail screen adds to the cart and links to the cart.
- A cart screen lists lines with increase, decrease and remove, the subtotal from `@tazumo/core`, and a checkout control that is disabled and labelled as a prototype.
- On-screen back and Android hardware back return to the previous screen with cart state preserved.
- The inline mini-cart keeps its behaviour and gains a "View cart" button.
- New controls get VoiceOver/TalkBack labels and stable `sut-` testIDs. Existing testIDs and the app ID `io.wopee.demos.tazumo` are unchanged.
- `apps/mobile/README.md` documents local builds, simulator smoke testing, EAS credentials and delivery.

## Scope
Synthetic catalogue and in-memory cart only. No real checkout, payment, merchant, courier or ETA. No persisted cart, deep links or EAS project configuration.
