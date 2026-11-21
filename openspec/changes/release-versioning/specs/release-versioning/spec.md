## ADDED Requirements

### Requirement: One product version
The SUT SHALL have one semver product version, recorded in `.release-please-manifest.json` and identical in the root, `apps/web`, `apps/api`, `apps/mobile` and `apps/backoffice` `package.json` and in `apps/mobile/app.json` `expo.version`.

#### Scenario: A version file drifts
- **WHEN** any of these files carries a different version than the manifest
- **THEN** `pnpm test` fails in `tests/contract/versioning.test.mts`.

### Requirement: Releases through a release PR
When the repository variable `RELEASE_PLEASE` is `enabled`, pushes to `main` SHALL run release-please, pinned to a commit SHA, on a GitHub-hosted runner, in the only job holding `contents: write` and `pull-requests: write`. It SHALL maintain a release PR built from Conventional Commits, and merging that PR SHALL create the tag `vX.Y.Z`, a GitHub Release and the `CHANGELOG.md` entry. Before 1.0, features and breaking changes SHALL bump the minor version and fixes the patch version.

#### Scenario: A feature lands on main
- **WHEN** a `feat:` commit is pushed to `main` after `v0.1.0`
- **THEN** release-please opens or updates a PR proposing `0.2.0` that bumps every version file and prepends the changelog entry, and nothing is pushed to `main` directly.

#### Scenario: Releases not yet enabled
- **WHEN** `RELEASE_PLEASE` is not `enabled`
- **THEN** the release job is skipped, not failed.

#### Scenario: Pull requests never get write tokens
- **WHEN** a pull request runs CI
- **THEN** the release workflow does not run and `node scripts/check-runner-guard.mjs` passes.

### Requirement: OpenAPI version follows contract changes
CI SHALL fail when `contracts/openapi.json` changes against the base without an `info.version` change, when the version decreases, or when it is not a semantic version.

#### Scenario: Contract edited without a bump
- **WHEN** a pull request edits an operation but keeps `info.version`
- **THEN** `pnpm check:openapi --base FETCH_HEAD` in `check` fails with "changed but info.version is still".

### Requirement: Build identity
Every web build SHALL serve `version.json` with `version`, `commit`, `builtAt`, `contracts.sut` and `contracts.openapi`, and SHALL put `tazumo-version` and `tazumo-commit` meta tags in `index.html`. The values SHALL come from the manifests, the contracts and the build's commit. The API's `/health` SHALL return `version` and `commit`.

#### Scenario: No commit available
- **WHEN** neither `TAZUMO_COMMIT`, `GITHUB_SHA` nor git yields a full 40-character SHA
- **THEN** `commit` is `unknown`, never empty or stale.

#### Scenario: Deployed preview
- **WHEN** the Pages workflow deploys `main`
- **THEN** the live smoke finds `version.json` with the repository's product and contract versions and the deployed commit SHA, and matching meta tags.

### Requirement: Native build numbers from CI
`ios.buildNumber` and `android.versionCode` SHALL come from `TAZUMO_BUILD_NUMBER` through `apps/mobile/app.config.js`, SHALL default to `1`, and SHALL NOT be committed.

#### Scenario: Invalid build number
- **WHEN** `TAZUMO_BUILD_NUMBER` is not a positive integer up to 2100000000
- **THEN** resolving the Expo config fails.
