# Tasks

- [x] Changelog review (TypeScript 7.0 announcement, 6.0 deprecations); findings recorded in the proposal.
- [x] Before the change, `tsc` 7.0.2 run per workspace on main f50cb73: all pass except `apps/mobile` (TS2591, `node:*` in `src/shopping.test.ts`).
- [x] All 13 manifests on `typescript ^7.0.2`; mobile gets `types: ["node"]` and `@types/node`; lockfile regenerated with pnpm 10.11.0; no `typescript@5` left in the lockfile.
- [x] `pnpm test` first failed in the SUT contract tests (`ts.ScriptTarget` undefined: no compiler API in 7.0). With `@typescript/typescript6` the tests pass, and `pnpm check:sut` prints the same result as on TypeScript 5.9 (SUT v0.4.0, 67 web and 38 native selectors in 16+7 files).
- [x] Local (macOS, Node 22.19.0): `pnpm typecheck` ok (`tsc` 7.0.2); `pnpm test` ok (core 17, brand 15, commerce 29, address 27, merchant-ops 31, orders 37, product-options 48, payments 36, contract 31; 0 fail); `pnpm build` ok; `pnpm --filter @tazumo/mobile test` ok; `pnpm audit --audit-level high` exits 0.
- [ ] Current-head CI green, including `bundle:mobile`, Web Playwright, the Android builds and the iOS simulator build.
- [ ] Independent review recorded in the PR.
