# Tasks

- [x] Issue #159 filed (status:ready, acceptance criteria), claimed; #120 marked as absorbed.
- [x] ADR-0028 and `docs/RELEASING.md`.
- [x] release-please config, manifest (`0.1.0`), `CHANGELOG.md`, `release.yml` pinned to `45996ed1f6d02564a971a2fa1b5860e934307cf7` (v5.0.0). Config validates against the release-please v17.6.0 schema with Ajv. `node scripts/check-runner-guard.mjs`: 24 jobs verified. `actionlint` clean on `release.yml`, `pages.yml`, `ci.yml`.
- [x] `pnpm check:openapi --base origin/main` passes; with the description edited and the version kept it fails with "changed but info.version is still 0.7.0-draft". Replayed over all 7 historical `contracts/openapi.json` commits: every one passes.
- [x] Local: `pnpm typecheck && pnpm test && pnpm build` green (contract tests 37 pass, including 8 in `versioning.test.mts`); `PLAYWRIGHT_PORT=4520 pnpm test:e2e` 51 passed, including both `build-identity.spec.ts` tests; `pnpm bundle:mobile` green.
- [x] API: `pnpm --filter @tazumo/api test` against a disposable postgres:16-alpine, 123 pass. Mutation: dropping `...build` from the 200 response fails the `/health` test.
- [x] Expo config: `TAZUMO_BUILD_NUMBER=4217 expo config --type public` gives `ios.buildNumber` `4217` and `android.versionCode` `4217`; unset gives `1` and `1`; `abc` exits 1.
- [x] Pages smoke against a local static server at `http://127.0.0.1:4521/tazumo/` (Pages base build): 4/4 pass; with `EXPECTED_COMMIT` set to another SHA the version test fails.
- [ ] Current-head CI on the PR.
- [ ] After merge: `v0.1.0` release exists, `release.yml` run on `main` green, first release PR opened, Pages live smoke checks the deployed `version.json`.
