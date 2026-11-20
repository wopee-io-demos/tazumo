# Tasks

- [x] CodeQL workflow: read-only PR gate and upload job, actions pinned to SHAs. `actionlint` 1.7.12 is clean, and the #69 runner guard (`check-runner-guard.mjs` from `ci/55-fork-pr-runner-guard`) reports no failure for the new jobs.
- [x] Secret-scan workflow and allowlist. Local gitleaks 8.30.1 run over the `origin/main` history with `.github/gitleaks.toml`: no leaks. Local probe: a fake `ghp_` token was reported, and the `tazumo-synthetic-` high-entropy value was reported without the config and not reported with it.
- [x] Dependabot config validates against the schemastore `dependabot-2.0` schema with ajv.
- [x] ADR-0020 and the `docs/SECURITY.md` proposed ruleset. Field names were checked against the GitHub REST OpenAPI description, and the JSON parses.
- [ ] CI on the PR head: `CodeQL PR analysis` and `Secret scan` green.
- [ ] Negative CI test: a planted fake secret fails `Secret scan` on a throwaway PR, which is closed unmerged.
- [ ] Independent review findings resolved.
- [ ] After merge: the CodeQL upload job on `main` succeeds, and the first Dependabot run is visible.
