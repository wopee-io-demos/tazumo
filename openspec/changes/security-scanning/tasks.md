# Tasks

- [x] CodeQL workflow: read-only PR gate and upload job, actions pinned to SHAs. `actionlint` 1.7.12 is clean, and the #69 runner guard (`check-runner-guard.mjs` from `ci/55-fork-pr-runner-guard`) reports no failure for the new jobs.
- [x] Secret-scan workflow and allowlist. Local gitleaks 8.30.1 run over the `origin/main` history with `.github/gitleaks.toml`: no leaks. Local probe: a fake `ghp_` token was reported, and the `tazumo-synthetic-` high-entropy value was reported without the config and not reported with it.
- [x] Dependabot config validates against the schemastore `dependabot-2.0` schema with ajv.
- [x] ADR-0020 and the `docs/SECURITY.md` proposed ruleset. Field names were checked against the GitHub REST OpenAPI description, and the JSON parses.
- [ ] CI on the PR head: `CodeQL PR analysis` and `Secret scan` green.
- [x] Negative CI test, throwaway PR #78 (`a12/secret-scan-negative-test`). It adds one fake credential and one `tazumo-synthetic-` value. In [run 44821074526](https://github.com/wopee-io-demos/tazumo/actions/runs/44821074526) `Secret scan` failed: 2 commits scanned, 1 leak found (the planted value; the synthetic one was not reported). The re-run with verbose output is recorded on the PR, and #78 is closed unmerged.
- [x] Self-suppression is blocked. Local gitleaks 8.30.1 on a repo with a `gitleaks:allow` comment and a `.gitleaksignore` fingerprint: the default flags give 0 findings, and the CI flags with `.gitleaksignore` removed give 2.
- [x] Independent review at 81bff90: 1 blocker, 2 major, 4 minor and 2 nit findings, all addressed in the second commit.
  - Blocker: 5 `js/missing-rate-limiting` results. Addressed with a CodeQL config exclusion and follow-up #98.
  - Major: `.gitleaksignore` and inline `gitleaks:allow` bypasses are now ignored. Dependabot now ignores Expo-family minor and major updates.
  - Minor: no cancellation of push scans on `main`; merge-commit, lockfile and `RUNNER_MODE` limits documented.
  - Nits: `chore` commit prefix; anchored `tazumo-ci-only`.
- [ ] After merge: the CodeQL upload job on `main` succeeds, and the first Dependabot run is visible.
