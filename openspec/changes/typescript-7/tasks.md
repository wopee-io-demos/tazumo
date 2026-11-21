# Tasks

- [x] Changelog review (TypeScript 7.0 announcement, 6.0 deprecations); findings recorded in the proposal.
- [x] Before the change, `tsc` 7.0.2 run per workspace on main f50cb73: all pass except `apps/mobile` (TS2591, `node:*` in `src/shopping.test.ts`).
- [x] All 13 manifests on `typescript ^7.0.2`; mobile gets `types: ["node"]` and `@types/node`; lockfile regenerated with pnpm 10.11.0; no `typescript@5` left in the lockfile.
- [x] `pnpm test` first failed in the SUT contract tests (`ts.ScriptTarget` undefined: no compiler API in 7.0). With `@typescript/typescript6` the tests pass, and `pnpm check:sut` prints the same result as on TypeScript 5.9 (SUT v0.4.0, 67 web and 38 native selectors in 16+7 files).
- [x] Local (macOS, Node 22.19.0): `pnpm typecheck` ok (`tsc` 7.0.2); `pnpm test` ok (core 17, brand 15, commerce 29, address 27, merchant-ops 31, orders 37, product-options 48, payments 36, contract 31; 0 fail); `pnpm build` ok; `pnpm --filter @tazumo/mobile test` ok; `pnpm audit --audit-level high` exits 0.
- [x] Merged main at 456edc5 (after #170); `pnpm install` leaves the lockfile unchanged, and the frozen install passes. Re-run: `pnpm typecheck`, `pnpm test`, `pnpm build` and the mobile tests pass; `pnpm check:sut` prints the same as main on TypeScript 5.9 (SUT v0.5.0, 69 web and 46 native selectors in 16+11 files).
- [x] CI on 97772a7: `bundle:mobile` (Quality checks) and the Android release bundle (`createBundleReleaseJsAndAssets`) failed in Expo CLI's `evaluateTsConfig` (`reading 'getCurrentDirectory'`), as an independent review also found. Fix: `experiments.tsconfigPaths: false` in `apps/mobile/app.json`, which skips that call; the app has no `paths` or `baseUrl`.
- [ ] Current-head CI green, including `bundle:mobile`, Web Playwright, the Android builds and the iOS simulator build.
- [ ] Independent review recorded in the PR.
