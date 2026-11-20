# ADR-0001: Cross-platform TypeScript monorepo

Status: Accepted (native compilation under verification)
Date: 2026-11-20

## Context
Tazumo targets responsive web, iOS and Android with one shared domain layer and a small team. Expo SDK 53 does not reliably support pnpm's isolated dependency installation for native apps.

## Decision
Use pnpm workspaces with `nodeLinker: hoisted`, React/Vite for web, Expo/React Native for mobile, and pure TypeScript for shared domain logic. Do not force shared rendering components across DOM/native.

## Alternatives
Flutter shares a single rendering framework but increases migration cost from existing React. Separate apps duplicate domain logic. React Native Web could share UI but SEO needs are not yet established.

## Consequences
Hoisting improves SDK 53 native autolinking but weakens dependency isolation. Explicitly declare imports, validate app native builds in CI and reconsider isolated installs on an Expo SDK that supports them. Native compile currently tracked in issue #10. Runtime smoke tests still needed.

## Update 2026-11-20: lockfile and Expo SDK evaluation ([#14](https://github.com/wopee-io-demos/tazumo/issues/14))

**Lockfile.** `pnpm-lock.yaml` is committed. It was generated with pnpm 10.11.0 (the `packageManager` pin) and `nodeLinker: hoisted`. Every workflow installs with `pnpm install --frozen-lockfile`, and `actions/setup-node` caches the pnpm store (`cache: pnpm`). A PR that changes dependencies (any dependency field or override in a `package.json`) must run `pnpm install` and commit the updated lockfile, or CI fails at install. The lockfile is platform-neutral: it was generated on macOS, and CI verifies it by installing frozen on Linux and macOS runners. With `RUNNER_MODE` set to self-hosted, `cache: pnpm` still uses the GitHub cache. That is harmless but redundant with the runner's local store.

**Expo SDK evaluation (no upgrade made).** Versions observed on npm and docs.expo.dev on 2026-11-20:

| | In repo | Expo SDK 54 | Latest: Expo SDK 58 |
| --- | --- | --- | --- |
| `expo` | ~53.0.0 (53.0.27 is the last patch) | 54.0.38 | 58.0.26 (released 2026-09-29) |
| `react-native` | 0.79.2 (SDK 53 expects 0.79.6) | 0.81.5 | 0.88.1 |
| `react` | 19.0.0 | 19.1.0 | 19.3.0 |
| pnpm isolated installs | not supported, hoisted recommended | supported | supported |

- SDK 53 is five releases behind. The Expo docs' compatibility table now lists only SDK 56, 57 and 58.
- The Expo monorepo guide states: "Starting with SDK 54, Expo supports isolated dependencies." So the `nodeLinker: hoisted` workaround can be removed only after moving to SDK 54 or later, and only once native builds pass with isolated installs.
- Recommendation: upgrade straight to the current SDK (58, React Native 0.88) in one dedicated PR that runs `npx expo install --fix`, regenerates the lockfile, keeps every `testID` and accessibility ID, and proves the Android APK and iOS simulator builds in CI. After that, a separate PR removes `nodeLinker: hoisted`. The upgrade is tracked in [#100](https://github.com/wopee-io-demos/tazumo/issues/100).
