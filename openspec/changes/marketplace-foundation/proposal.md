# Proposal: Initial marketplace foundation

Related issues: [#2](https://github.com/wopee-io-demos/tazumo/issues/2), [#3](https://github.com/wopee-io-demos/tazumo/issues/3), [#4](https://github.com/wopee-io-demos/tazumo/issues/4), [#7](https://github.com/wopee-io-demos/tazumo/issues/7).

## Why
The original private prototype is food-delivery-specific and not a shared web/native codebase. Tazumo needs a scalable place to develop platform-independent domain logic, brand experiments and customer experiences.

## What changes
Introduce pnpm workspace, shared types and cart logic, responsive web UI, native Expo app, design tokens, CI, ADRs and OpenSpec source files.

## Scope
Prototype product discovery and local cart only. No real ordering, payment, account, courier availability, regional tax calculation or guaranteed delivery. Product examples and prices are synthetic demonstration data.

## Open questions
- Formal name and domain clearance
- Real API and merchant inventory source
- Payment provider and compliance
- European market/localisation priorities
- iOS and Android simulator checks, app store credentials
