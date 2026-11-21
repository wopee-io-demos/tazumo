## ADDED Requirements

### Requirement: Static analysis on every pull request
The repository SHALL run CodeQL for JavaScript/TypeScript on every pull request, on every push to `main` and weekly. The pull request job SHALL hold only read permissions and SHALL fail when the analysis reports any result that a reviewed, issue-linked exclusion does not cover. Only the job that uploads results SHALL hold `security-events: write`, and that job SHALL NOT run for pull requests.

#### Scenario: Clean pull request
- **WHEN** a pull request introduces no CodeQL result
- **THEN** `CodeQL PR analysis` passes without any write-scoped token

#### Scenario: Fork pull request
- **WHEN** a fork opens a pull request
- **THEN** every CodeQL and secret-scan job runs on a GitHub-hosted runner without secrets or write permissions

### Requirement: Secret scan of the changed commits
The repository SHALL scan the pull request commit range, each push to `main` and, weekly, the full history with a checksum-verified gitleaks binary. The scan SHALL redact findings, upload nothing and fail on any finding outside the documented allowlist. On pull requests the allowlist SHALL come from the base commit.

#### Scenario: Planted credential
- **WHEN** a pull request commit adds a credential-shaped value
- **THEN** `Secret scan` fails and the log shows the file and line with the value redacted

#### Scenario: Synthetic fixture value
- **WHEN** a commit adds a fixture secret matching `tazumo-synthetic-[A-Za-z0-9-]{1,64}`
- **THEN** `Secret scan` does not report it

#### Scenario: Pull request widens the allowlist
- **WHEN** a pull request edits `.github/gitleaks.toml` to allowlist its own credential
- **THEN** the scan of that pull request still uses the base commit's allowlist and fails

#### Scenario: Pull request suppresses its own finding
- **WHEN** a pull request adds a `.gitleaksignore` entry or a `gitleaks:allow` comment for its credential
- **THEN** `Secret scan` ignores both and fails

### Requirement: Automated dependency updates
Dependabot SHALL propose grouped weekly npm and github-actions updates with open-PR limits. Expo-pinned packages SHALL receive patch updates only.

#### Scenario: Weekly update run
- **WHEN** the weekly Dependabot run finds updates
- **THEN** at most 5 npm PRs and 3 github-actions PRs are open at once, grouped as configured
