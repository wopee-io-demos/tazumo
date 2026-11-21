# TypeScript 7 for every workspace

## Why
Issue [#149](https://github.com/wopee-io-demos/tazumo/issues/149): the owner-approved plan updates majors one evaluated PR at a time. TypeScript 7.0 (the native compiler) is current; 5.9 receives no further releases.

## What Changes
- Every workspace and the root move from `typescript ^5.8.3` to `^7.0.2`, with the regenerated `pnpm-lock.yaml` (pnpm 10.11.0).
- `apps/mobile` declares `"types": ["node"]` and `@types/node ^22.15.0`. TypeScript 7 defaults `types` to `[]`, so its `node:test` unit tests no longer saw Node's types through hoisting.
- TypeScript 7.0 ships no JavaScript compiler API: its package exports only `lib/version.cjs`. `scripts/sut-contract.mjs` parses TSX with `ts.createSourceFile`, so it now imports `@typescript/typescript6` (6.0.2, pinned), the compatibility package that re-exports the 6.0 API.

## Changelog review (5.9 → 7.0)
Changed defaults: `strict` on, `types: []`, `rootDir: ./`, `noUncheckedSideEffectImports` on, `libReplacement` off. Hard errors: `moduleResolution node10/classic`, `baseUrl`, `target es5`, `downlevelIteration`, `module amd/umd/system/none`, `esModuleInterop: false`. All tsconfigs use `bundler` resolution, ES2022 or later and no `baseUrl`, and expo 53's `tsconfig.base` uses `bundler`/`preserve`. Web's CSS side-effect imports are covered by the `vite/client` reference in `apps/web/src/auth/env.d.ts`. Expo CLI reads only `typescript/package.json` (dev-server prerequisite), which TypeScript 7 still exports; Metro, Vite and Playwright do not load the compiler.

## Alternatives
- Stay on 5.9: no further fixes, and every later major gets harder.
- Upgrade to 6.0 first: 6.0 only deprecates what 7.0 removes, and our configs need neither step.
- Rewrite `sut-contract.mjs` on a different parser: a larger, riskier change to the SUT contract check than pinning the official compatibility package.

## Impact
- `tsc` is the native binary from the platform package for each OS; the lockfile lists all of them as optional.
- When TypeScript 7.1 ships its new API, `sut-contract.mjs` can move off `@typescript/typescript6`.
