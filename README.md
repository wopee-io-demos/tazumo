# Tazumo

Europe-first, multi-category delivery marketplace. **Working three-platform prototype, not a live ordering service.**

## Packages
- `apps/web`: React/Vite responsive marketplace with Playwright-tested category, search, cart and palette changes.
- `apps/mobile`: Expo React Native iOS/Android app. Both debug Android APK and iOS Simulator .app compile.
- `packages/core`: shared typed catalogue/cart functions.
- `packages/brand`: independent branding and color palettes.
- `openspec/`: requirements and implementation tasks.
- `docs/adr/`: architecture decisions.

## Quickstart
Node 22, pnpm 10.
```sh
corepack enable
pnpm install
pnpm dev:web
pnpm dev:mobile
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:mobile
pnpm exec playwright install chromium
pnpm test:e2e
```

## Verified
- [Web tests + builds](https://github.com/wopee-io-demos/tazumo/actions/runs/44767554583), green.
- [Android debug APK and iOS Simulator app](https://github.com/wopee-io-demos/tazumo/actions/runs/44767543758), green. Development artifacts expire November 27, 2026.

Not verified: native device launch, signed distribution, web deployment. No accounts, real merchant inventory, payments, courier tracking, or production checkout. Catalogue/prices are illustrative. Trademark, domain and mascot rights not cleared.

## Delivery governance
[GitHub Issues backlog](https://github.com/wopee-io-demos/tazumo/issues) is the operational tracker. Changes require issue, OpenSpec and, when relevant, ADR. Read [PR quality and merge policy](docs/PR-QUALITY.md).
