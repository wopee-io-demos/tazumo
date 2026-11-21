# TypeScript 7 for every workspace

## Why
Issue [#149](https://github.com/wopee-io-demos/tazumo/issues/149): the owner-approved plan updates majors one evaluated PR at a time. TypeScript 7.0 (the native compiler) is current; 5.9 receives no further releases.

## What Changes
- Every workspace and the root move from `typescript ^5.8.3` to `^7.0.2`, with the regenerated `pnpm-lock.yaml` (pnpm 10.11.0).
- `apps/mobile/app.json` sets `experiments.tsconfigPaths: false` (see the changelog review).
- `apps/mobile` declares `"types": ["node"]` and `@types/node ^22.15.0`. TypeScript 7 defaults `types` to `[]`, so its `node:test` unit tests no longer saw Node's types through hoisting.
- TypeScript 7.0 ships no JavaScript compiler API: its package exports only `lib/version.cjs`. `scripts/sut-contract.mjs` parses TSX with `ts.createSourceFile`, so it now imports `@typescript/typescript6` (wrapper pinned at 6.0.2; it depends on `typescript@^6`, locked at 6.0.3), the compatibility package that re-exports the 6.0 API.

## Changelog review (5.9 → 7.0)
Changed defaults: `strict` on, `types: []`, `rootDir: ./`, `noUncheckedSideEffectImports` on, `libReplacement` off. Hard errors: `moduleResolution node10/classic`, `baseUrl`, `target es5`, `downlevelIteration`, `module amd/umd/system/none`, `esModuleInterop: false`. All tsconfigs use `bundler` resolution, ES2022 or later and no `baseUrl`, and expo 53's `tsconfig.base` uses `bundler`/`preserve`. Web's CSS side-effect imports are covered by the `vite/client` reference in `apps/web/src/auth/env.d.ts`. Expo CLI (SDK 53) calls the TypeScript API in one place: with `experiments.tsconfigPaths` on (the default), every Metro bundle resolves `typescript` from the project and calls `ts.sys`, `readConfigFile` and `parseJsonConfigFileContent` to read `paths`/`baseUrl`. On TypeScript 7 that fails (`Cannot read properties of undefined (reading 'getCurrentDirectory')` in `bundle:mobile`). The mobile app uses neither `paths` nor `baseUrl`, so `apps/mobile/app.json` turns the experiment off. The dev-server prerequisite only checks that `typescript/package.json` exists. `expo-modules-autolinking` would call `ts.transpileModule` only for a dependency that ships `react-native.config.ts`, and none does. Vite and Playwright do not load the compiler.

## Alternatives
- Stay on 5.9: no further fixes, and every later major gets harder.
- Upgrade to 6.0 first: 6.0 only deprecates what 7.0 removes, and our configs need neither step.
- Rewrite `sut-contract.mjs` on a different parser: a larger, riskier change to the SUT contract check than pinning the official compatibility package.

## Impact
- `tsc` is the native binary from the platform package for each OS; the lockfile lists all of them as optional.
- When TypeScript 7.1 ships its new API, `sut-contract.mjs` can move off `@typescript/typescript6`.
- If the mobile app ever needs tsconfig `paths`, it must re-enable `experiments.tsconfigPaths`, which needs an Expo SDK that supports TypeScript 7 (#100).
