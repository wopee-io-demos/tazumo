# ADR-0020: CodeQL, gitleaks and Dependabot in CI, and a proposed required-checks ruleset

Status: Proposed
Date: 2026-11-20
Tracking: issue #15, OpenSpec `security-scanning`, related to #69 (fork-PR runner guard) and #14 (lockfile and Expo SDK upgrade)

## Context

Tazumo is a public repository. `security.yml` already fails a PR on high or critical npm advisories. Nothing scans the code itself or the commits for leaked credentials, and nothing proposes dependency updates. `main` has no branch protection or ruleset, so every gate is a process rule, not a server-enforced one. Untrusted fork PRs must never reach the self-hosted pool or hold a write token (#69).

## Decision

### CodeQL: a read-only PR gate and a separate upload job

`.github/workflows/codeql.yml` analyses `javascript-typescript` with `build-mode: none`. Both jobs use the default query suite. The PR job loads `.github/codeql/codeql-config.yml`, which excludes `js/missing-rate-limiting` until #98 rate-limits the public API routes. The upload job keeps the query, so those alerts stay visible in the Security tab. The first run reported 5 results: the public catalogue and health routes have no limit, and CodeQL does not model the custom bearer-route limiter.

- **`CodeQL PR analysis`** runs on `pull_request` only. It holds `contents: read` and nothing else, runs `analyze` with `upload: never`, and fails when the SARIF output contains any result. Each finding is printed as an `::error` annotation.
- **`CodeQL analysis and upload`** runs on push to `main`, weekly (Monday 05:27 UTC) and on dispatch. It is the only job that holds `security-events: write`, and it uploads results to code scanning.

Alternatives considered:

| Option | Why not |
| --- | --- |
| One job with `security-events: write` on every event (GitHub's starter workflow) | It gives PR jobs a write scope. The runner guard in #69 fails any `pull_request` job with write permissions, and the PR gate needs no upload to fail on a finding. |
| Default setup (repository setting) | It is a repository setting, which is out of scope for agents, and it cannot coexist with an advanced workflow. |
| `security-extended` suite | Lower-precision queries would make "fail on any result" noisy. This can be revisited once a baseline exists. |

Cost: PRs get annotations in the job log, not code scanning PR alerts. Alerts on `main` still appear in the Security tab.

### Secret scanning: the gitleaks binary, checksum-verified

`.github/workflows/secret-scan.yml` downloads the gitleaks 8.30.1 linux x64 release archive, verifies its SHA-256 and scans with `gitleaks git --redact`. Nothing is uploaded, and no licence or secret is needed.

- **Range:** a PR scans `base.sha..head.sha`. A push to `main` scans `before..after`, or the full history when `before` is missing. The weekly schedule and dispatch scan the full history.
- **Allowlist:** `.github/gitleaks.toml` extends the default rules with two whole-secret entries: the disposable CI Postgres password `tazumo-ci-only`, and fixture secrets that match `^tazumo-synthetic-[A-Za-z0-9-]{1,64}$`. On a PR the allowlist is read from the base commit, and a checked-out `.gitleaksignore` and inline `gitleaks:allow` comments are ignored. A PR therefore cannot allowlist its own leak through configuration, and an allowlist change takes effect only after merge.
- **Merge commits:** gitleaks runs `git log -p` without `-m`, so content that only a merge commit inside a PR introduces is not scanned on the PR. The squash merge's push scan on `main` covers it.
- **Logs:** `--redact --verbose` prints the rule, file, line and commit of each finding, with the value replaced by `REDACTED`.

Alternatives considered:

| Option | Why not |
| --- | --- |
| `gitleaks/gitleaks-action` | It requires a `GITLEAKS_LICENSE` secret for organisation repositories, and secrets are unavailable to fork PRs. |
| Docker image pinned by digest | Equivalent, but slower to start and harder to read than a checksum line. |
| TruffleHog action | Its default verification sends candidate secrets to provider APIs. Turning that off leaves a heavier tool than gitleaks for the same job. |
| GitHub secret scanning and push protection | They are repository settings (out of scope for agents) and complementary. The owner should still enable them. |
| Path allowlist for fixture files | It would also hide a real secret pasted into those files. |

### Dependabot

- **npm:** `/`, `/apps/*` and `/packages/*`, weekly on Monday, 5-day cooldown, at most 5 open PRs.
  - `expo-sdk` groups the Expo and React family. Their minor and major updates are ignored, because Expo pins them per SDK (#14).
  - `npm-minor-and-patch` groups everything else. Majors arrive one per PR (superseded, see the 2026-11-21 update).
  - `npm-security` groups security updates.
- **github-actions:** one weekly group, 5-day cooldown, at most 3 open PRs. Dependabot keeps SHA pins and their version comments current.
- **No lockfile:** without a committed `pnpm-lock.yaml` (#14), Dependabot updates manifests only and cannot raise transitive security fixes. Those stay with `pnpm audit` and the overrides in `package.json` until #14 lands a lockfile.

### Runners and fork PRs

Every new job runs on hosted `ubuntu-24.04`. The self-hosted pool does not serve public repositories and must never run fork code. Triggers are `pull_request`, `push`, `schedule` and `workflow_dispatch`. There is no `pull_request_target`, no `secrets.*` reference and no reusable workflow. Workflow-level permissions are `{}`, and every checkout uses `persist-credentials: false`.

### Proposed required checks (not applied)

Agents must not change rulesets. The repository owner applies the command in `docs/SECURITY.md#proposed-required-checks-ruleset`. It creates one ruleset on the default branch that blocks deletion and force-push, requires a PR merged by squash with resolved review threads, and requires these GitHub Actions (app 15368) checks:

| Check | Workflow | Required | Reason |
| --- | --- | --- | --- |
| `check` | Quality checks | yes | Runs on every PR: typecheck, unit tests, web build, Expo bundles and E2E |
| `evidence` | Test evidence | yes | Runs on every PR: contract, E2E and accessibility evidence |
| `dependency-audit` | Dependency security review | yes | Runs on every PR: high and critical advisories |
| `CodeQL PR analysis` | CodeQL | yes | Runs on every PR |
| `Secret scan` | Secret scan | yes | Runs on every PR |
| `iOS simulator build` | Native development builds | no | The hosted macOS queue is unreliable, and a queued required check blocks every merge |
| `Android debug APK` | Native development builds | no | Path-filtered on PRs. A required check that never starts stays "Expected" and blocks unrelated PRs |
| `api` | API integration | no | Path-filtered, same reason. The merge gate still checks it when it runs |
| `CodeQL analysis and upload` | CodeQL | no | Never runs on PRs |

- **Strict mode is off:** an up-to-date branch is not required, because forcing every open PR to rebase after each merge re-queues long jobs for parallel agents. A merge queue is the better tool if strict ordering becomes necessary.
- **Runner dependency:** `check`, `evidence` and `dependency-audit` reach a runner only while `vars.RUNNER_MODE == 'hosted'` (or, after #69, for fork PRs). The self-hosted pool does not serve this public repository, so flipping the variable would leave these required checks queued and block every merge.
- **No approvals:** the required approval count is 0, because every agent pushes as the same GitHub identity and cannot approve its own PR. Independent approval and CODEOWNERS stay open on #15 until a second identity exists.

## Consequences

- PRs gain two new failing gates: CodeQL findings and secrets in the commit range. A finding in an existing file fails every PR until it is fixed or excluded through a reviewed CodeQL configuration.
- The planted-secret test closes its throwaway PR without merging. The fake value stays reachable through that PR's `refs/pull/<n>/head`, so it must never resemble a live provider credential.
- Required checks become server-enforced only after the owner runs the command. Until then they remain a documented process.
- Renaming a required job breaks the ruleset. Rename jobs and the ruleset together.
- `pull_request` runs the PR's own copy of each workflow, so a PR can weaken a scan by editing the workflow itself. The same holds for `.github/codeql/codeql-config.yml`, which, unlike the gitleaks allowlist, is read from the PR checkout. A PR can therefore exclude a query and pass at once. Review of `.github/**` changes remains the final control until CODEOWNERS exists.

## Update 2026-11-21: no automatic major updates (issue #149)

By 2026-11-21 Dependabot had opened 15 PRs: one per directory for each major (TypeScript 7, Vite 8, `@types/node` 26), the same patch groups again from a second run, and none with a lockfile. Majors that change compilers, bundlers or runtime types need a changelog review and code changes, which a bot PR cannot carry.

Decision: both ecosystems ignore `version-update:semver-major`. Patch and minor updates stay in their groups (`expo-sdk` and `npm-minor-and-patch` for npm, `github-actions` for actions), one PR per group per run, spanning every directory with an update. A major update is a deliberate PR with a changelog review, the code changes it needs, a regenerated lockfile and green CI, including native builds. Security updates keep their own group and limit.

Alternatives:
- Keep one PR per major and close the unwanted ones by hand: the backlog grows every week, and each PR runs the full CI matrix.
- `group-by: dependency-name`: one PR per dependency across directories, which removes the per-directory duplicates but still opens majors automatically.
- Group majors with minor and patch updates: one breaking change blocks every safe update in the group.

`@types/node` also ignores every version from 23 up (`versions: ['>=23']`), because its major must follow the Node 22 runtime that CI and the API run. Change that rule together with the runtime.

Consequence: nothing announces a new major. It is noticed through `pnpm outdated`, security advisories or upstream deprecations, such as an action's Node.js runtime moving.
