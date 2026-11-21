## ADDED Requirements

### Requirement: Required checks always report
The workflows behind the required checks SHALL start on every pull request and SHALL report a conclusion even when their expensive steps are skipped.

#### Scenario: Docs-only pull request
- **WHEN** a pull request changes only Markdown, `docs/**` or `openspec/**`
- **THEN** `check`, `evidence`, `dependency-audit`, `CodeQL PR analysis` and `Secret scan` succeed, and install, build, bundling, e2e, audit and CodeQL analysis are skipped.

### Requirement: Work follows the changed files
CI SHALL run each expensive step only for the changes that can affect it, and SHALL run everything for pushes to `main`, schedules, manual runs, root install files, required workflow files and the classifier itself.

#### Scenario: API-only change
- **WHEN** a pull request changes only `apps/api/**`
- **THEN** `check` runs install, typecheck and tests, `evidence` skips Playwright, and the mobile bundle and web build are skipped.

#### Scenario: Mobile change
- **WHEN** a pull request changes `apps/mobile/**`, `packages/core/**` or `packages/brand/**`
- **THEN** `check` runs `pnpm bundle:mobile`.

#### Scenario: Workflow change
- **WHEN** `ci.yml` or `test-evidence.yml` changes
- **THEN** every step runs.

### Requirement: Playwright runs once per pull request
The `evidence` job SHALL own browser e2e and its report, and `check` SHALL NOT run Playwright.

#### Scenario: Web change
- **WHEN** a pull request changes `apps/web/**`
- **THEN** exactly one job runs `pnpm test:e2e`.

### Requirement: Concurrency never cancels main
Every workflow SHALL cancel superseded runs of the same pull request and SHALL NOT cancel or replace runs triggered on `main`.

#### Scenario: Two pushes to main in quick succession
- **WHEN** two commits land on `main` within a minute
- **THEN** both runs complete.
