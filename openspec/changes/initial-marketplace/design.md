# Design: initial marketplace

## Architecture
See ADR-0001, ADR-0002, ADR-0003. Web uses Next.js App Router. Mobile uses Expo Router and React Native native primitives. TypeScript packages provide common domain logic and palette configurations.

## Data flow
Synthetic immutable catalogue -> category/search filtering -> local cart state -> subtotal. Web persists a validated basket in localStorage; native basket currently lasts one app session.

## Tradeoffs
No shared UI framework at this stage: avoids fragile web/native abstractions. No backend or payment credentials without reviewed requirements. The example product feed cannot imply actual merchants or prices.

## Verification
Install dependencies; run typecheck and build; exercise category search/cart and palettes on browser, iOS simulator and Android emulator. Native CI builds and E2E tests are follow-up milestones.
