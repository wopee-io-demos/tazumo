# Tasks

- [x] Generate `pnpm-lock.yaml` with pnpm 10.11.0 (730 packages resolved). `pnpm install --frozen-lockfile` passes locally.
- [x] Switch the five workflows on main to `--frozen-lockfile` with `cache: pnpm` (12 lines added, 6 removed).
- [x] Takeover by A18 (#149) after A5 stopped: merged main at fd376b6 (after #76). Workflows added since (`backoffice`, `demo-videos`, `idp`, `pages`, `payments`, `screenshots`) and the restructured `ci`, `security` and `test-evidence` (#140) now install with `--frozen-lockfile`; `grep` finds no `--no-frozen-lockfile` in the repository. `idp.yml` triggers on `pnpm-lock.yaml`. `cache: pnpm` stays in the `api.yml` and `native-builds.yml` jobs, and the Android smoke job gained it.
- [x] Lockfile regenerated with pnpm 10.11.0 for the 11 workspace projects (734 packages, +143/-3 lines; existing pins kept). `pnpm install --frozen-lockfile` passes (1.9 s). `pnpm typecheck` and `pnpm test` pass (brand 15, core 17, commerce 29, merchant-ops 31, address 27, product-options 48, payments 34, plus contract tests; 0 failures). `pnpm audit --audit-level high` exits 0 (5 moderate). `check-agent-policy.py` and `check-repo-policy.mjs` pass.
- [x] Baseline install times from main runs `44821188031` (ci), `44821188014` (security), `44820242858` (api), `44821187940` (test-evidence) and `44820243006` (native): `pnpm install` took 5–9 s on Linux and 13–15 s on iOS.
- [x] ADR-0001 updated with the Expo SDK 53 → 58 evaluation and the lockfile policy.
- [ ] Current-head CI green on the PR, with install times on the first (cold-cache) run and a second (warm-cache) run recorded.
- [x] Follow-up issue for the Expo SDK upgrade filed: [#100](https://github.com/wopee-io-demos/tazumo/issues/100).
- [ ] The orchestrator warns the open PRs that change `package.json` (#105, #148, #156, #161, #163); they regenerate the lockfile after this merges.
