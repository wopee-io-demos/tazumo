# System architecture

## Goals
- Multi-category European marketplace with web + iOS + Android clients.
- Reuse domain contracts and brand tokens, without forcing cross-platform UI abstractions.
- Preserve brand choice independence: candidate name, mascot direction and palettes can change separately.
- Avoid misleading demonstrations: initial catalogue is synthetic; no live orders, payments or courier tracking.

## Monorepo
- `apps/web`: Next.js App Router storefront, responsive discovery/search/cart and palette experiment.
- `apps/mobile`: Expo Router React Native application targeting iOS and Android, with discovery/search/cart/palette experiment.
- `packages/catalog`: TypeScript domain types, example merchants/products, pure cart logic and EUR formatting.
- `packages/brand`: provisional naming, copy and selectable palettes.
- `openspec`: requirements, change proposals, design decisions, and implementation progress.
- `docs/adr`: durable architecture decision records.

## Future production boundaries
- Identity, merchant onboarding, catalogue ingestion, geospatial delivery area, cart/pricing, checkout/payment, fulfilment, dispatch, customer support, notifications, fraud and observability should be isolated services/modules behind versioned APIs.
- Model tenant and country explicitly; store prices as integer minor units and currencies as ISO 4217.
- Foodora demo source is a functional reference only, not a production backend. Its mock progress must not be represented as real courier tracking.
- Implement real authentication/payment only after backend threat modeling, data-retention policy and PSP selection.
- EU requirements to evaluate: GDPR, VAT, PSD2/SCA, Digital Services Act and consumer protection, accessibility and food/allergen information where applicable.

## Local setup
Node.js 22+, pnpm 10. `pnpm install`, then `pnpm dev:web` or `pnpm dev:mobile`.
Mobile: Expo Go for exploratory dev, development builds for capabilities requiring native modules. iOS simulator requires macOS/Xcode, Android emulator requires Android SDK. App Store and Google Play releases require signing, credentials and legal review.
