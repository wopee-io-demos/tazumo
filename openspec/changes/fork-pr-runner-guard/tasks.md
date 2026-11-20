# Tasks

- [x] Guard `runs-on` in `ci.yml`, `security.yml`, `test-evidence.yml` and `api.yml`; confirm `agent-issue-labels.yml` has no `pull_request` trigger.
- [x] Dry run with `node scripts/check-runner-guard.mjs`: all 6 events x 3 `RUNNER_MODE` values match the expected runner on every guarded job; the previous expression is evaluated as a control and fails 4 cases (fork and deleted-fork PRs with `RUNNER_MODE` unset or self-hosted).
- [x] Negative probes on copies of the workflows: the `main` version of `ci.yml` fails 4 cases; an added `secrets.` reference and `contents: write` are each reported.
- [ ] Same-repository PR run on the PR head selects the hosted runner (`RUNNER_MODE=hosted`) and passes.
- [ ] Independent review recorded; merged; merge SHA recorded in #55.
