# ADR-0028: One product version, independently versioned contracts

Status: Accepted
Date: 2026-11-21
Tracking: issue #159 (absorbs #120), OpenSpec `release-versioning`

## Context

Tazumo is the system under test for the demo repositories. Web, mobile and the API are built from one commit and ship together. Before this decision there were no tags, releases or changelog, every manifest said `0.1.0` and no deployment reported what it was built from, so consumers could not tell which build they were testing. The two contracts were already versioned: `contracts/sut.json` by semver enforced by `pnpm check:sut`, and `contracts/openapi.json` by hand. Squash-merge titles follow Conventional Commits by convention; nothing lints them yet (follow-up in the issue tracker).

## Decision

### One product version for the SUT

- The Tazumo SUT has one semver product version. The source of truth is `.release-please-manifest.json` (`"."`), mirrored into the root `package.json`, `apps/web`, `apps/api`, `apps/mobile` and `apps/backoffice` `package.json`, and `apps/mobile/app.json` (`expo.version`). A contract test fails if any of them disagree.
- Workspace libraries under `packages/` stay private and unversioned in practice. Nothing is published to a registry, so their `version` fields carry no meaning.
- Releases are tags `vX.Y.Z` with a GitHub Release and a `CHANGELOG.md` entry, all created by release-please (below). `v0.1.0` is the baseline: the last commit before automated releases, tagged once by hand. Every later tag comes from a release PR.

### Release automation: release-please, manifest mode, one root component

- `.github/workflows/release.yml` runs `googleapis/release-please-action`, pinned to a commit SHA, on every push to `main`, on a GitHub-hosted runner. It is the only job with `contents: write` and `pull-requests: write`. The workflow default is no permissions.
- release-please keeps one release PR open with the next version, the changelog entry and the version bumps. Merging that PR creates the tag and the GitHub Release.
- The release PR goes through the same ruleset as any other PR: required checks, squash merge, no direct pushes to `main`. It is opened with the workflow token, and GitHub does not start workflows for events caused by that token, so the maintainer closes and reopens the PR to run the checks before merging. A GitHub App token would make this automatic. It needs a secret the repository does not have yet.
- release-please needs the `autorelease: pending` and `autorelease: tagged` labels; they are created in the repository up front, so the job needs no `issues: write`.
- Only `feat`, `fix`, `perf`, `revert` and `deps` commits appear in the changelog and cause a release. `docs`, `test`, `ci`, `build`, `refactor` and `chore` (including `chore(deps)`) do not.

### Pre-1.0 policy

- `0.y.z` means the demo is still changing shape. A breaking change (`feat!:` or a `BREAKING CHANGE:` footer) or a feature bumps the minor version. A fix bumps the patch version. Nothing reaches `1.0.0` automatically.
- `1.0.0` is cut deliberately with a `Release-As: 1.0.0` footer in a squash commit message once the repository owner declares the SUT stable. That should not happen before the SUT contract reaches `1.0.0`.

### Contracts stay independently versioned

- `contracts/sut.json` keeps its own semver, enforced against the previous contract by `pnpm check:sut` (a removed or renamed ID is major, a new ID is minor, prose is patch).
- `contracts/openapi.json` keeps its own semver (`-draft` while no API is deployed). `pnpm check:openapi --base <ref>` fails CI when the contract changes without a version change, when the version goes down, or when it is not valid semver. The bump level stays a review decision (additive change: next minor), as in the API conventions.
- The product version and the contract versions are related only through the build identity, not by arithmetic. Every build reports the contract versions it shipped with in `version.json`. A PR that bumps a contract says so in its title (for example `feat(sut): contract 0.3.0 ...`), so the bump appears in the changelog. A breaking SUT contract change (major) must be released as a breaking product change, so consumers see it in the product version as well.

### Build identity

- The web build writes `version.json` (`version`, `commit`, `builtAt`, `contracts.sut`, `contracts.openapi`) and `<meta name="tazumo-version">` and `<meta name="tazumo-commit">` into `index.html`, from `scripts/build-info.mjs`. The commit is `TAZUMO_COMMIT`, then the HEAD of the Tazumo checkout itself, then `GITHUB_SHA` only inside this repository's workflows, and `unknown` when none gives a full SHA. A consumer building a pinned checkout in its own workflow must not report its own commit. It is never empty and never hand-edited.
- The API's `GET /health` returns `version` (from `apps/api/package.json`) and `commit` (`TAZUMO_COMMIT`, otherwise `unknown`). `/health` stays outside the OpenAPI contract, so these fields are informal.
- Native builds take `ios.buildNumber` and `android.versionCode` from `TAZUMO_BUILD_NUMBER`, which `native-builds.yml` sets to `github.run_number`, through `apps/mobile/app.config.js`. They default to `1` locally and are never committed.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Changesets, one version per package | Built for publishing packages independently. Nothing here is published, and the apps are only meaningful together as one SUT. Per-package versions would leave consumers with several numbers to pin and still no single answer to "which build is this". It also asks every PR for a changeset file, which parallel agents would forget or conflict on. |
| Manual tags and a hand-written changelog | Depends on someone remembering, produces no reviewable PR before a release, and drifts from the manifests. Conventional Commits already hold the information. |
| semantic-release (release on every merge) | Pushes the version bump and changelog straight to `main`, which the ruleset forbids, and releases on every merge. A release PR keeps releases deliberate and reviewable. |
| Version the SUT by the SUT contract version | The contract changes far less often than the app, and many releases (fixes, new screens behind existing IDs) do not change it. Tying them would either freeze the product version or force meaningless contract bumps. |

## Consequences

- Consumers pin a contract version for compatibility and check `version.json` or `/health` for the exact build. See [RELEASING](../RELEASING.md).
- Every merge to `main` with a releasable commit updates the release PR. Releasing is merging that PR after its checks pass.
- A PR that edits `contracts/openapi.json` must bump `info.version` in the same PR.
- GitHub Actions in this repository must be allowed to create pull requests (repository setting), since the release PR is opened with the workflow token. The release job runs only when the repository variable `RELEASE_PLEASE` is `enabled`, so the owner turns releases on after changing that setting, and `main` never carries a release job that fails by design.
