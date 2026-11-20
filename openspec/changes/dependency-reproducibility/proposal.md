# Change: Committed lockfile and frozen, cached CI installs

Issue: [#14](https://github.com/wopee-io-demos/tazumo/issues/14) · ADR: [0001](../../../docs/adr/0001-monorepo-cross-platform.md) (update section)

## Why
CI resolved dependencies afresh on every run (`pnpm install --no-frozen-lockfile` with no committed lockfile), so two runs of the same commit could install different versions.

## What changes
- Commit `pnpm-lock.yaml` (pnpm 10.11.0, `nodeLinker: hoisted`).
- `ci.yml`, `security.yml`, `api.yml`, `test-evidence.yml` and `native-builds.yml` install with `--frozen-lockfile` and cache the pnpm store with `actions/setup-node` `cache: pnpm`. Only the install and setup lines change.
- ADR-0001 records the Expo SDK evaluation; the upgrade itself is a follow-up issue.

## Out of scope
- Expo SDK upgrade and removal of `nodeLinker: hoisted`.
- Workflows that exist only in open PRs. They get the same two-line change through comments on those PRs.
- Runner selection (`runs-on`) and job structure.
