# Dependency security

## 2026-11-20 high-severity advisories
Initial PR security run 44772710082 identified four high advisories from PostCSS (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849) and image-size (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr). Two transitive override constraints were added in root package.json: postcss ^8.5.18 and image-size ^2.0.3.

This is a proposed dependency remediation. CI audit, JS bundles and native builds MUST pass after dependency overrides before any merge. Track a future Expo SDK upgrade and lockfile in #14. Avoid ignoring high/critical advisories to obtain a green check.

## Automated scanning (ADR-0020)

| Check | Workflow | When | Fails on |
| --- | --- | --- | --- |
| `dependency-audit` | `security.yml` | PRs, `main`, weekly | High or critical npm advisories |
| `CodeQL PR analysis` | `codeql.yml` | PRs (read-only token) | Any CodeQL JavaScript/TypeScript result outside the exclusions in `.github/codeql/codeql-config.yml` (`js/missing-rate-limiting` until #98; the upload job still reports it). The config is read from the PR itself, so review every change to it |
| `CodeQL analysis and upload` | `codeql.yml` | `main`, weekly, dispatch | Analysis errors. Results go to the Security tab |
| `Secret scan` | `secret-scan.yml` | PRs, `main`, weekly, dispatch | Any gitleaks finding in the scanned commits |

- **Runners and permissions:** all new jobs run on GitHub-hosted `ubuntu-24.04`. None uses `pull_request_target` or `secrets.*`. Only the upload job holds a write scope (`security-events: write`), and it never runs on PRs.
- **Secret-scan ranges:** a PR scans its commit range (`base..head`), a push to `main` scans the pushed range, and the weekly run scans the full history. Logs are redacted and nothing is uploaded.
- **Dependabot (`.github/dependabot.yml`):**
  - npm is checked weekly with a 5-day cooldown and at most 5 PRs. Updates are grouped as `expo-sdk`, `npm-minor-and-patch` and `npm-security`, one PR per group per run across the workspace directories.
  - Major version updates are not proposed automatically, for npm or github-actions. Each major is a deliberate PR with a changelog review and green CI (ADR-0020, 2026-11-21 update).
  - Expo, React and React Native majors and minors are left to the Expo SDK upgrade (#14).
  - github-actions is checked weekly as one group, at most 3 PRs. SHA pins are updated with their version comments.
  - Without a committed lockfile (#14), Dependabot updates manifests only. Transitive advisories are handled by `pnpm audit` and `pnpm.overrides`.

### Secret-scan allowlist

`.github/gitleaks.toml` extends the gitleaks default rules. On a PR the allowlist is read from the base commit, so a change to it takes effect only after merge. CI ignores `.gitleaksignore` files and inline `gitleaks:allow` comments.

| Entry | Covers | Why it is safe |
| --- | --- | --- |
| `tazumo-ci-only` | Password of the throwaway Postgres service container in `api.yml` | Exists only inside a CI job. It is not a real credential |
| `^tazumo-synthetic-[A-Za-z0-9-]{1,64}$` (whole secret) | Synthetic fixture tokens, keys and passwords | Real provider credentials never take this shape |

Fixture credentials must use the `tazumo-synthetic-` prefix, or be generated at test time (as `apps/api/test/idp.ts` does for signing keys). Do not add path-wide allowlists.

Run the scan locally with gitleaks 8.30.1:

```bash
gitleaks git --config .github/gitleaks.toml --log-opts="origin/main..HEAD" --ignore-gitleaks-allow --redact --verbose .
```

**If the scan fails on a real credential:**
1. Revoke the credential at its provider first.
2. Remove it from the branch history.
3. Report it on the issue without quoting the value.

### Proposed required-checks ruleset

This ruleset has not been applied. Agents do not change repository settings, so the repository owner (admin) runs it once. It makes the checks below server-enforced on the default branch.

- **Required (run on every PR):** `check`, `evidence`, `dependency-audit`, `CodeQL PR analysis`, `Secret scan`.
- **Left out:**
  - `iOS simulator build`: the hosted macOS queue is unreliable.
  - `Android debug APK` and `api`: path-filtered, so a required check that never starts would block unrelated PRs.
  - `CodeQL analysis and upload`: never runs on PRs.
  - Required approvals: every agent shares one GitHub identity. Independent review stays open on #15.
- **Runner dependency:** `check`, `evidence` and `dependency-audit` run on hosted runners only while `vars.RUNNER_MODE` is `hosted`. Keep it that way while this ruleset is active, or required checks queue forever.
- **Up-to-date branches are not required.** Forcing a rebase after every merge would re-queue long jobs for parallel agents. ADR-0020 has the reasoning.

```bash
gh api --method POST repos/wopee-io-demos/tazumo/rulesets --input - <<'JSON'
{
  "name": "main: required checks",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "check", "integration_id": 15368 },
          { "context": "evidence", "integration_id": 15368 },
          { "context": "dependency-audit", "integration_id": 15368 },
          { "context": "CodeQL PR analysis", "integration_id": 15368 },
          { "context": "Secret scan", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
```

`integration_id` 15368 is the GitHub Actions app, so only Actions can satisfy these checks. Verify the result with `gh api repos/wopee-io-demos/tazumo/rulesets`. To roll back, run `gh api --method DELETE repos/wopee-io-demos/tazumo/rulesets/<id>`. Rename a required job only together with this ruleset.

The owner should also enable GitHub secret scanning and push protection (repository settings, free for public repositories) as a second layer.
