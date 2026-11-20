# Technical design

See [ADR-0001](../../../docs/adr/0001-monorepo-cross-platform.md), [ADR-0002](../../../docs/adr/0002-brand-independent-tokens.md).

## Components
- Web: React 19, Vite 6, TypeScript; CSS tokens supplied from brand package.
- Mobile: Expo SDK 53, React Native 0.79, React 19, Safe Area Context.
- Core: immutable quantity operations, filter and locale currency formatting, typed product fixtures.
- Brand: independently selectable palette, current provisional name and fox concept.

## Data lifecycle
Local in-memory product fixtures -> searchable category listings -> cart quantity state -> subtotal. No persistence or external API. Future service boundary should use versioned OpenAPI contracts, order state machine and server-confirmed pricing.

## Risks
React Native/Expo native integration and peer version constraints need verification in macOS/iOS/Android CI. Currency is hardcoded EUR demonstration; introduce country-localized fees and tax before launch. Imagery is emoji placeholders. No production security assertions are made.
