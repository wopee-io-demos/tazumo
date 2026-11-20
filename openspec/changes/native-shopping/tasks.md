# Tasks

- [x] Route stack, cart-line and remove helpers in `apps/mobile/src/shopping.ts`; `pnpm --filter @tazumo/mobile test` 5/5 pass locally (Node 22.19), including a check that every documented testID is in the source.
- [x] Product detail and cart screens with localized (en/cs/de) labels, roles and `sut-` testIDs; `pnpm typecheck && pnpm test && pnpm build && pnpm bundle:mobile` pass locally.
- [x] Mini-cart "View cart" entry (`sut-cart-screen-open`); existing testIDs and app ID unchanged.
- [x] Screen-reader focus moves to the screen title on navigation; quantity changes are announced.
- [x] EAS credentials and delivery process documented in `apps/mobile/README.md`.
- [x] Local native simulator evidence, 2026-11-20: Release simulator build of cdd0b03 with Xcode 27.2 (fmt C++17 workaround), installed on a dedicated iPhone 17 / iOS 26.5 simulator, driven with mobilecli 1.0.24. Observed in the UI tree:
  - catalogue `sut-open-product-pizza` -> `sut-detail-screen`;
  - `sut-detail-add` -> "In your cart: 1" and the header shows "View cart, 1";
  - `sut-nav-cart` -> `sut-cart-screen` with "Subtotal €11.90";
  - increase -> 2 / €23.80; decrease -> 1 / €11.90;
  - `sut-cart-checkout-disabled` reports `enabled: false`, and tapping it changes nothing;
  - remove -> `sut-cart-empty` with €0.00;
  - back -> detail with quantity 0; back -> catalogue "Cart, 0";
  - catalogue add -> mini-cart -> `sut-cart-screen-open` -> cart screen with quantity 1.
- [ ] CI `Native development builds` (Android APK + iOS simulator .app) green on the PR head.
- [ ] Android device/emulator smoke (no local Android SDK; follow-up needed).
- [ ] Merge SHA recorded on #4.
