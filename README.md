# Tazumo

Europe-first, multi-category local delivery marketplace. **Early prototype, not a production service.**

## Repository

- `apps/web`: responsive Vite + React web marketplace
- `apps/mobile`: Expo + React Native consumer experience targeting iOS and Android
- `packages/core`: shared TypeScript catalogue, filters, cart and EUR formatting
- `packages/brand`: independent name, palette and mascot design tokens
- `openspec/`: spec-first proposals, delta requirements and implementation tasks
- `docs/adr/`: architecture decision records

## Quick start

Requires Node.js 22+, pnpm 10+.

```sh
corepack enable
pnpm install
pnpm dev:web     # responsive website
pnpm dev:mobile  # Expo development server for iOS/Android
pnpm typecheck
pnpm test
pnpm build
```

**Native builds have not been verified yet.** iOS requires macOS/Xcode or a configured EAS build service. Android requires Android Studio/SDK or EAS. The starter app has no stores, external API or payments configured.

## Delivery status

| Workstream | Status | Issue |
| --- | --- | --- |
| Monorepo scaffold | Implemented, CI pending verification | [#2](https://github.com/wopee-io-demos/tazumo/issues/2) |
| Web prototype with browse/search/cart | Implemented, not deployed | [#3](https://github.com/wopee-io-demos/tazumo/issues/3) |
| iOS/Android Expo prototype | Source implemented, native builds unverified | [#4](https://github.com/wopee-io-demos/tazumo/issues/4) |
| Production API/payments/real courier tracking | Not implemented | [#5](https://github.com/wopee-io-demos/tazumo/issues/5) |
| Formal brand/legal clearance, original fox artwork | Not completed | [#6](https://github.com/wopee-io-demos/tazumo/issues/6) |
| Specification/ADR governance | Initial docs implemented | [#7](https://github.com/wopee-io-demos/tazumo/issues/7) |

## Provenance and migration

The functionality was inspired by private prototype `vem-sandbox/foodora-new` (restaurant browsing, menu search, favourites, cart, checkout, operator workflows and simulated tracking). **This is a clean new implementation, not a complete port.** Authentication, merchants, persistence, favourites, actual payments and order management remain to be built. Do not copy source .env files or other secret material into this repository.

The chosen name **Tazumo remains provisional**. EU trademark, domain and local-language checks are still outstanding. Purple is a selectable initial palette, not a fixed brand decision. The fox is a concept represented by a placeholder emoji, not original production mascot artwork.

## Progress workflow

Every workstream must have a GitHub Issue, with acceptance criteria and explicit status. For meaningful product changes, create `openspec/changes/<slug>/` containing proposal, specs, design and tasks, and link to issue and PR. Record irreversible architectural choices in `docs/adr/`. Never mark build/test, real-time, app-store, security or payment checks complete without evidence.

## References

- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [Decision records](docs/adr/README.md)
- [Initial change](openspec/changes/marketplace-foundation/proposal.md)
