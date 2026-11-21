# Tasks

- [x] `.github/dependabot.yml` ignores `version-update:semver-major` for npm and github-actions; groups, schedule, cooldown and limits unchanged.
- [x] Config validates against the schemastore `dependabot-2.0` schema with ajv (`valid true`); a probe with the invalid update type `semver-major` fails validation (1 error).
- [x] ADR-0020 update (2026-11-21) and `docs/SECURITY.md` describe the policy.
- [x] Independent review on a8c66ec: no blocking findings; wording on duplicates, archive order and PR closure fixed in the next commit.
- [ ] Archive order: `security-scanning` is archived before this change, because this delta modifies its requirement.
- [x] Current-head CI green on d0314aa (PR #152): Quality checks 44880940571, Test evidence 44880940595, Dependency security review 44880940598, CodeQL 44880940545, Secret scan 44880940623. Merged as 24d76ad.
- [x] After #152 merged, Dependabot itself closed the major PRs #110-#119 and #123 ("no longer being updated").
- [x] `@types/node` ignore `versions: ['>=23']` (runtime is Node 22); schema validation with ajv passes.
- [x] Grouped patch update after the lockfile (#101): jose 6.2.15 → 6.2.17 in `apps/api` with the regenerated `pnpm-lock.yaml`. It supersedes #109 and #137. Releases younger than the 5-day cooldown (jose 6.2.18, oauth4webapi 3.8.9, stripe 23.2.0) are left to Dependabot.
- [ ] After merge: the next weekly run opens no major-update PRs (observed on the first Monday run after merge).
