# Change: Committed lockfile and frozen, cached CI installs

Issue: [#14](https://github.com/wopee-io-demos/tazumo/issues/14) · ADR: [0001](../../../docs/adr/0001-monorepo-cross-platform.md) (update section)

## Why
CI resolved dependencies afresh on every run (`pnpm install --no-frozen-lockfile` with no committed lockfile), so two runs of the same commit could install different versions.

## What changes
- Commit `pnpm-lock.yaml` (pnpm 10.11.0, `nodeLinker: hoisted`).
- Every workflow that installs workspace dependencies uses `pnpm install --frozen-lockfile`: `api.yml`, `backoffice.yml`, `ci.yml`, `demo-videos.yml`, `idp.yml`, `native-builds.yml`, `pages.yml`, `payments.yml`, `screenshots.yml`, `security.yml` and `test-evidence.yml`. The jobs in `api.yml` and `native-builds.yml` also cache the pnpm store with `actions/setup-node` `cache: pnpm`. `idp.yml` triggers on `pnpm-lock.yaml` changes, like the other path-filtered workflows. Only install, setup and trigger-path lines change.
- ADR-0001 records the Expo SDK evaluation; the upgrade itself is a follow-up issue.

## Out of scope
- Expo SDK upgrade and removal of `nodeLinker: hoisted`.
- Workflows that exist only in open PRs. Their authors switch to `--frozen-lockfile` when they merge main.
- Runner selection (`runs-on`) and job structure.
