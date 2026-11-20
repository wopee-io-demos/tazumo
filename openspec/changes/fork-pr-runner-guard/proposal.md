# Fork pull requests never run on self-hosted runners

## Why
Issue [#55](https://github.com/wopee-io-demos/tazumo/issues/55). The repository is public, and every `pull_request` workflow chose its runner from `vars.RUNNER_MODE` alone. With the variable unset or not `hosted`, a pull request from a fork would run untrusted code on the self-hosted `demos` pool, which `docs/ENGINEERING-POLICY.md` forbids.

## What Changes
- `ci.yml`, `security.yml`, `test-evidence.yml` and `api.yml` fall back to `ubuntu-latest` when `github.event_name == 'pull_request'` and the head repository is not this repository. Same-repository pull requests, pushes, schedules and manual runs keep the current behaviour for every `RUNNER_MODE`.
- `agent-issue-labels.yml` runs only on push and manual dispatch, so it is unchanged.
- `scripts/check-runner-guard.mjs` evaluates every workflow's `runs-on` expression with GitHub's own expression engine (`@actions/expressions`) across push, schedule, dispatch, same-repo, fork and deleted-fork pull requests, with `RUNNER_MODE` hosted, unset and self-hosted. Every other job must use a GitHub-hosted label. It fails on unmodelled triggers with an expression runner, reusable-workflow jobs, `pull_request_target`, and on secrets (other than `GITHUB_TOKEN`) or write permissions in jobs that can run on `pull_request` (a job `if:` is evaluated). `test-evidence.yml` runs it.

## Limits
For `pull_request`, GitHub runs the workflow files from the pull request's merge ref, so a malicious fork can edit `runs-on` or the guard itself. This change stops this repository's own workflows from routing fork code to the pool by mistake; it is not the security boundary. The controls that stop a hostile fork are outside the repository and were verified read-only on 2026-11-20: the organization's only runner group, `Default`, has `allows_public_repositories: false`, and the repository's fork pull request approval policy is `all_external_contributors`. Because tazumo is public, its jobs cannot use the pool at all while that group setting stands; `RUNNER_MODE=hosted` reflects that.

## Impact
- Root `package.json` gains `@actions/expressions` and `yaml` (exact versions) as devDependencies.
- Overlaps draft #33, which also edits `ci.yml`; this change touches only the `runs-on` line.
