# Tasks

- [x] Guard `runs-on` in `ci.yml`, `security.yml`, `test-evidence.yml` and `api.yml`; confirm `agent-issue-labels.yml` has no `pull_request` trigger.
- [x] Dry run with `node scripts/check-runner-guard.mjs`: all 6 events x 3 `RUNNER_MODE` values match the expected runner on every guarded job; the previous expression is evaluated as a control and fails 4 cases (fork and deleted-fork PRs with `RUNNER_MODE` unset or self-hosted).
- [x] Negative probes on copies of the workflows: the `main` version of `ci.yml` fails 4 cases; an added `secrets.` reference and `contents: write` are each reported.
- [x] Mutation probes after review: `workflow_run` with a static self-hosted runner, reusable-workflow job with `secrets: inherit`, object `runs-on` with a self-hosted label, `secrets['X']`, entry through a symlinked path containing a space: each fails. A push-only publish job (`if: github.event_name == 'push'`, `packages: write`, `secrets.NPM_TOKEN`) and a static `macos-15` job pass.
- [x] Same-repository PR run selects the hosted runner (`RUNNER_MODE=hosted`): the guard step ran on ubuntu-26.04 in run 44818616891 on 10bdff3.
- [x] Review pass 2 fixes: a job is skipped only when its `if:` is provably false for pull requests (three-valued evaluation: operands other than `github.event_name` are unknown). Probes `vars.PUBLISH == 'true'`, a label `contains(...)`, `github.actor == ...`, `always()`, `github.event_name != 'push'` with write permissions fail; push or dispatch-only conditions, including #30's publish jobs, pass. Hosted runners come from an explicit label list (`ubuntu-demos` fails); only `${{ }}` expressions are scanned for secrets.
- [x] Independent review recorded in PR #69 (passes on 10bdff3 and c19fd2f).
- [x] Current-head CI green on 502578e: Quality checks 44819730350, Test evidence 44819730201 (guard step), API 44819730206, dependency review 44819730279, native builds 44819730191. A trial merge with `main` (new `codeql.yml`, `secret-scan.yml`) passes the guard for 10 jobs.
- [x] Merged as cf73894 (PR #69); merge SHA recorded in #55.
