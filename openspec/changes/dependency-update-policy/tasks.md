# Tasks

- [x] `.github/dependabot.yml` ignores `version-update:semver-major` for npm and github-actions; groups, schedule, cooldown and limits unchanged.
- [x] Config validates against the schemastore `dependabot-2.0` schema with ajv (`valid true`); a probe with the invalid update type `semver-major` fails validation (1 error).
- [x] ADR-0020 update (2026-11-21) and `docs/SECURITY.md` describe the policy.
- [ ] Independent review recorded in the PR.
- [ ] Current-head CI green.
- [ ] After merge: the next weekly run opens no major-update PRs (observed on the first Monday run after merge).
