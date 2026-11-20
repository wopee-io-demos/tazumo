## ADDED Requirements

### Requirement: Untrusted pull requests use hosted runners
Every workflow that can select the self-hosted runner pool SHALL select `ubuntu-latest` for a `pull_request` event whose head repository differs from the base repository, whatever `RUNNER_MODE` is set to.

#### Scenario: Fork pull request with RUNNER_MODE unset
- **WHEN** a fork opens a pull request and `RUNNER_MODE` is unset
- **THEN** every job runs on `ubuntu-latest`.

#### Scenario: Pull request from a deleted fork
- **WHEN** the head repository of a pull request no longer exists
- **THEN** the job is treated as untrusted and runs on `ubuntu-latest`.

#### Scenario: Trusted events keep the configured pool
- **WHEN** a same-repository pull request, a push to `main`, a schedule or a manual run starts with `RUNNER_MODE` unset
- **THEN** the job selects the self-hosted pool exactly as before.

### Requirement: Pull request workflows hold no secrets or write tokens
A workflow triggered by `pull_request` SHALL NOT reference secrets or grant write permissions, and no workflow SHALL use `pull_request_target`.

#### Scenario: Guard detects a regression
- **WHEN** a `runs-on` expression, secret reference or permission violates these rules
- **THEN** `node scripts/check-runner-guard.mjs` exits non-zero and names the workflow, job and case.
