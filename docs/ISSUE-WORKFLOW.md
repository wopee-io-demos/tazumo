# Concurrent agents and resumable GitHub Issues

GitHub Issues are the **single operational queue**. OpenSpec describes behavior and tasks, ADRs describe durable decisions, PRs contain code, and CI/artifacts prove outcomes. No private chat transcript is required for another agent to continue.

## Lifecycle states (exactly one per issue)

| Label | Meaning | Agent action |
| --- | --- | --- |
| `status:backlog` | Idea or incomplete acceptance criteria | Triage, clarify scope, split dependency |
| `status:ready` | Actionable, unclaimed, acceptance tests and dependencies recorded | Safe candidate to claim |
| `status:in-progress` | Assigned agent owns active branch and PR | Other agents work on unrelated issues, not same files |
| `status:in-review` | Implementation posted, independent/self-review documented, CI evaluating | Verify head SHA, evidence, review and merge gates |
| `status:blocked` | Missing runner, approval, access, upstream SUT, secrets or failing check | Read blocker + exact unblocking instructions |
| `status:done` | PR merged, acceptance verified and branch cleanup recorded | Reopen if regression; link follow-up issue |

These are GitHub **labels**, not the GitHub open/closed state. A status label is intended to be unique; issue state stays open until done. If a GitHub Project is introduced, its Status field may mirror labels, but GitHub Project synchronization is not installed or asserted here.

### Initialize labels and claim work

The connected integration may not create repository labels. An authorized maintainer/agent with `gh` access runs:

```bash
gh auth status
bash scripts/issue-status.sh bootstrap
bash scripts/issue-status.sh board
bash scripts/issue-status.sh claim 123
bash scripts/issue-status.sh move 123 in-review
bash scripts/issue-status.sh handoff 123 /tmp/handoff.md blocked
```

This bootstrap is **not automatic** and is not evidence that any status labels currently exist. Until initialized, record `Agent status: status:...` in the issue body and use `Status:` search, avoiding invented labels. CLI claiming is not atomic across agents. After claiming, re-read issue assignee, status, comments and competing PRs before editing. If two agents claim simultaneously, one must release and coordinate before commits.

## Every issue contains a durable context packet

- **Outcome + acceptance criteria**, positive/negative checks and out-of-scope cases.
- **Agent status**, human/account assignee, branch, linked draft PR and dependency issues (cross-repo links included).
- **Versioned input**: SUT contract version, configuration, fixture/build SHA, relevant OpenSpec and ADR.
- **Current verified evidence**, exact commands/runner version, logs and screenshot/artifact URLs, plus truthfully untested cases.
- **Next action**, specific failure/blocker, owner of external dependency, and safe retry/review path.
- **Handoff checkpoint**, last known good commit SHA, worktree changes, important design choices and whether branch was pushed.

Start new tasks at `backlog`, refine to `ready`, claim `in-progress`, submit PR `in-review`, then `done` only after merge and verification. Move to `blocked` with exact unblocking condition. Never label a failed/pending job as green.

## Parallel execution and conflict avoidance

1. Each new agent starts at [START-HERE](START-HERE.md), queries live Issues/PRs and checks branch heads; never trust an old status snapshot.
2. Pick a `ready` **unassigned** issue with no incompatible open PR. Claim ownership before implementation and announce branch, files, dependencies and expected interface to other agents on the issue.
3. Prefer small vertical PRs. Do not share branches, rewrite another agent's head, or change the same files without a coordination comment. For SUT consumers, land Tazumo's contract first; pin exact version before updating demos.
4. Document OpenSpec proposal/spec/tasks and ADR decisions in the PR. Record real CI and device/browser evidence for setup, test authoring, maintenance and execution.
5. Use delegated review agents when possible. Review separately for functionality, safety, test quality, architecture, accessibility and cross-repo contract compatibility. Self-review cannot substitute mandatory approval.
6. Merge proactively **only** after current-head checks, branch protections and required approvals pass. Do not bypass rules because CI runners are missing. Record merge SHA, update issue/OpenSpec, remove merged branch and release ownership.
7. If interrupted, append the handoff template below as an issue comment, include a linked branch or uncommitted-change warning, then release or retain ownership explicitly.

## Handoff template

```markdown
### Agent handoff | YYYY-MM-DD
Agent status: status:blocked (or status:ready / status:in-review)
Owner / next owner:
Goal and acceptance criteria:
Relevant issues / PRs / OpenSpec / ADR:
Branch / latest pushed SHA:
SUT contract version / tested app build:
Done and evidence (commands, result, CI URLs):
Not done / risks / known failures:
Files touched / likely conflicts:
One concrete next action:
Unblocker (who/what/permission, if any):
```

**Never use documentation to assert work is finished.** Issue metadata and verified merge/CI results control status; docs link to these rather than duplicating stale progress.
