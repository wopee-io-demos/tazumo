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

## Dependency notes

- **`image-size` (#136, 2026-11-21):**
  - The root pnpm override keeps every registry copy on `image-size@^2.0.3`, which fixes the high-severity advisories GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq and GHSA-m5qc-5hw7-8vg7. No patched 1.x release exists.
  - Metro 0.82 (Expo SDK 53) still calls the 1.x API, `require('image-size')(bufferOrPath)`. Debug bundles therefore failed with `getImageSize is not a function`. Production exports were unaffected.
  - A scoped override `metro>image-size` points Metro at the in-repo adapter `@tazumo/image-size-v1-compat` (`apps/mobile/tooling/image-size-v1-compat`). That adapter keeps the 1.x call signature and delegates to the patched 2.x parser, installed under the alias `image-size-v2`.
  - `pnpm bundle:mobile`, which the required `check` job runs, now also builds the iOS and Android debug bundles (`expo export --dev`) as a regression guard.
  - Remove the adapter and the scoped override once the Expo SDK upgrade (#100) ships a Metro that uses `image-size` 2.x.
