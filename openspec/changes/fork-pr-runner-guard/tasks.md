# Tasks

- [x] Guard `runs-on` in `ci.yml`, `security.yml`, `test-evidence.yml` and `api.yml`; confirm `agent-issue-labels.yml` has no `pull_request` trigger.
- [x] Dry run with `node scripts/check-runner-guard.mjs`: all 6 events x 3 `RUNNER_MODE` values match the expected runner on every guarded job; the previous expression is evaluated as a control and fails 4 cases (fork and deleted-fork PRs with `RUNNER_MODE` unset or self-hosted).
- [x] Negative probes on copies of the workflows: the `main` version of `ci.yml` fails 4 cases; an added `secrets.` reference and `contents: write` are each reported.
- [x] Mutation probes after review: `workflow_run` with a static self-hosted runner, reusable-workflow job with `secrets: inherit`, object `runs-on` with a self-hosted label, `secrets['X']`, entry through a symlinked path containing a space: each fails. A push-only publish job (`if: github.event_name == 'push'`, `packages: write`, `secrets.NPM_TOKEN`) and a static `macos-15` job pass.
- [x] Same-repository PR run selects the hosted runner (`RUNNER_MODE=hosted`): the guard step ran on ubuntu-26.04 in run 44818616891 on 10bdff3.
- [ ] Independent review recorded; merged; merge SHA recorded in #55.
