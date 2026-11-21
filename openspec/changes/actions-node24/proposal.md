# GitHub Actions on current majors, pinned to commit SHAs

## Why
Issue [#149](https://github.com/wopee-io-demos/tazumo/issues/149). Most workflows used tag refs (`@v4`) of actions whose v4 runs on the deprecated Node.js 20 runtime. Dependabot's #123 bumped only the six workflows that existed at its base, kept tag refs, and is closed. The repository convention is SHA pins with a version comment, which Dependabot keeps current.

## What Changes
Every `uses:` in `.github/workflows/` is pinned to a full commit SHA with its version comment:
- `actions/checkout` v4 → v7.0.1
- `actions/setup-node` v4 → v7.1.0
- `actions/upload-artifact` v4 → v7.0.2
- `pnpm/action-setup` v4 → v6.1.1
- `actions/setup-java` v4 → v6.3.0
- `actions/cache` v4 → v6.1.0
- Already-pinned actions are unchanged.

## Changelog review
- All the new majors run on Node.js 24 and need Actions Runner v2.327.1 or newer. The self-hosted `mac-ios-1` that runs the iOS build reports 2.338.2; the other jobs run on GitHub-hosted runners (`RUNNER_MODE=hosted`).
- `checkout`: v6 keeps persisted credentials in a separate file (workflows use `persist-credentials: false` or do not push). v7 refuses fork-PR checkouts under `pull_request_target` and `workflow_run`; neither trigger is used.
- `setup-node`: v5/v6 auto-caching applies to npm only. Our `packageManager` is pnpm, so caching stays explicit (`cache: pnpm`).
- `pnpm/action-setup`: v6 bootstraps pnpm 11 and self-updates to the pinned `version: 10.11.0`. `payments.yml` and `pages.yml` already used this pin on main.
- `upload-artifact` v7 and `cache` v6: ESM builds, with no input changes for our usage. `setup-java` v6: Zulu metadata changes only; we use temurin.

## Impact
CI only. No package.json or lockfile change.
