# Tasks

- [x] Route stack, cart-line and remove helpers in `apps/mobile/src/shopping.ts`; `pnpm --filter @tazumo/mobile test` 4/4 pass locally (Node 22.19).
- [x] Product detail and cart screens with localized (en/cs/de) labels, roles and `sut-` testIDs; `pnpm typecheck` passes locally.
- [x] Mini-cart "View cart" entry; existing testIDs and app ID unchanged.
- [x] EAS credentials and delivery process documented in `apps/mobile/README.md`.
- [ ] Local iOS simulator Release build, install and mobilecli smoke (browse -> product -> add -> cart).
- [ ] CI `Native development builds` (Android APK + iOS simulator .app) green on the PR head.
- [ ] Independent review findings resolved; merge SHA recorded on #4.
