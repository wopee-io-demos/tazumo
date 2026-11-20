# Fork pull requests never run on self-hosted runners

## Why
Issue [#55](https://github.com/wopee-io-demos/tazumo/issues/55). The repository is public, and every `pull_request` workflow chose its runner from `vars.RUNNER_MODE` alone. With the variable unset or not `hosted`, a pull request from a fork would run untrusted code on the self-hosted `demos` pool, which `docs/ENGINEERING-POLICY.md` forbids.

## What Changes
- `ci.yml`, `security.yml`, `test-evidence.yml` and `api.yml` fall back to `ubuntu-latest` when `github.event_name == 'pull_request'` and the head repository is not this repository. Same-repository pull requests, pushes, schedules and manual runs keep the current behaviour for every `RUNNER_MODE`.
- `agent-issue-labels.yml` runs only on push and manual dispatch, so it is unchanged.
- `scripts/check-runner-guard.mjs` evaluates every workflow's `runs-on` expression with GitHub's own expression engine (`@actions/expressions`) across push, schedule, dispatch, same-repo, fork and deleted-fork pull requests, with `RUNNER_MODE` hosted, unset and self-hosted. It also fails when a `pull_request` workflow references secrets, grants write permissions or uses `pull_request_target`. `test-evidence.yml` runs it.

## Impact
- Root `package.json` gains `@actions/expressions` and `yaml` (exact versions) as devDependencies.
- Overlaps draft #33, which also edits `ci.yml`; this change touches only the `runs-on` line.
