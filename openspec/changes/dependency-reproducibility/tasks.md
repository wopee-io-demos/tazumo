# Tasks

- [x] Generate `pnpm-lock.yaml` with pnpm 10.11.0 (730 packages resolved). `pnpm install --frozen-lockfile` passes locally.
- [x] Switch the five workflows on main to `--frozen-lockfile` with `cache: pnpm` (12 lines added, 6 removed).
- [x] Baseline install times from main runs `44821188031` (ci), `44821188014` (security), `44820242858` (api), `44821187940` (test-evidence) and `44820243006` (native): `pnpm install` took 5–9 s on Linux and 13–15 s on iOS.
- [x] ADR-0001 updated with the Expo SDK 53 → 58 evaluation and the lockfile policy.
- [ ] Current-head CI green on the PR, with install times on the first (cold-cache) run and a second (warm-cache) run recorded.
- [x] Follow-up issue for the Expo SDK upgrade filed: [#100](https://github.com/wopee-io-demos/tazumo/issues/100).
- [ ] Snippet posted on the open workflow PRs (#57, #74, #77) and the dependency-changing PRs warned.
