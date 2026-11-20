# ADR-0013: State-based in-app navigation for the native prototype

Status: Accepted
Date: 2026-11-20
Issue: [#4](https://github.com/wopee-io-demos/tazumo/issues/4)

## Context
The Expo app needs three screens (catalogue, product detail, cart) sharing one in-memory cart. Native dependencies must stay compatible with Expo SDK 53, the pnpm hoisted install and the unsigned CI simulator/APK builds. Dependency upgrades are tracked separately in #14.

## Options
1. **React Navigation native stack**: platform transitions and gestures, but adds `@react-navigation/*`, `react-native-screens` and their native modules, version pinning against SDK 53 and more CI build risk.
2. **Expo Router**: file-based routes and deep links, but restructures the app entry, needs the same native modules and changes the bundle layout other agents rely on.
3. **A typed route stack in React state**: no new dependency; Android hardware back via `BackHandler`; no native transitions or swipe-back gesture.

## Decision
Use option 3. `apps/mobile/src/shopping.ts` holds a pure, unit-tested route stack; `App.tsx` renders the screen on top of the stack.

## Consequences
No native dependency or build change, and the screens stay plain components that can move to a navigator later. There are no deep links, no iOS swipe-back gesture and no screen transition animation. Revisit when the app needs deep links, more than a handful of screens, tab navigation or the Expo SDK upgrade in #14.
