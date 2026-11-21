# Security scanning and proposed required checks

Refs #15. Decision record: ADR-0020.

## Why
`main` has a dependency audit, but nothing scans the code or the commits for leaked credentials, and nothing proposes dependency updates. No branch ruleset exists, so the checks are a process rule, not a server-enforced one.

## What changes
- `codeql.yml`: a read-only CodeQL JavaScript/TypeScript gate on PRs, plus an upload job on `main`, weekly and on dispatch. The upload job is the only one holding `security-events: write`.
- `secret-scan.yml` and `.github/gitleaks.toml`: a checksum-verified gitleaks scan of the PR range, the pushed range and the weekly full history. Two allowlist entries cover synthetic values, and on PRs the allowlist is read from the base commit.
- `.github/dependabot.yml`: grouped weekly npm and github-actions updates with a cooldown and open-PR limits.
- `docs/SECURITY.md`: scanning overview, allowlist policy and a proposed required-checks ruleset as a `gh api` command. Only the repository owner applies the ruleset.

## Out of scope
Applying the ruleset, repository settings (GitHub secret scanning, push protection), changes to existing workflows, CODEOWNERS and independent approval. CODEOWNERS and independent approval need a second GitHub identity.
