# CI dependency installation

## ADDED Requirements

### Requirement: Reproducible installs
Every CI workflow that installs workspace dependencies SHALL install exactly the versions recorded in the committed `pnpm-lock.yaml`.

#### Scenario: Lockfile matches manifests
- **WHEN** a workflow runs `pnpm install --frozen-lockfile` on a commit whose lockfile matches every `package.json`
- **THEN** the install succeeds without resolving new versions

#### Scenario: Manifest changed without lockfile
- **WHEN** a pull request changes a `package.json` dependency but not `pnpm-lock.yaml`
- **THEN** the install step fails, and the author must run `pnpm install` and commit the lockfile

### Requirement: Cached package store
The jobs in `api.yml` and `native-builds.yml` that install workspace dependencies SHALL restore and save the pnpm store keyed on `pnpm-lock.yaml`, using `actions/setup-node` with `cache: pnpm` after `pnpm/action-setup`. Jobs that run `actions/setup-node` before deciding whether to install pnpm (`ci.yml`, `security.yml`, `test-evidence.yml`) install without the cache, because `cache: pnpm` needs pnpm on the PATH.

#### Scenario: Unchanged lockfile
- **WHEN** a second run uses the same lockfile hash on the same runner OS
- **THEN** the store is restored from the cache before `pnpm install`
