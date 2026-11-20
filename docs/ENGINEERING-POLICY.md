# Shared engineering policy, Wopee demo organization

Applies to **tazumo, mobile-agent, mobile-demo, web-demo and web-demo-pw-cli**. Each fresh agent starts from [START-HERE](START-HERE.md), [ISSUE-WORKFLOW](ISSUE-WORKFLOW.md), the live GitHub Issue board, open PRs and current CI. Chat history is not a prerequisite.

## Issue-first, parallel work
- Every change, including docs, tests, automation, dependencies and CI, implements an **existing detailed GitHub Issue**. Exactly one of `status:backlog`, `status:ready`, `status:in-progress`, `status:in-review`, `status:blocked` and `status:done` applies.
- Claim only `status:ready`, unassigned issues with acceptance criteria. Use `bash scripts/issue-status.sh claim NUMBER`, re-read live ownership and PRs immediately after (the claim operation is **not atomic**), and coordinate collisions in comments.
- Publish the owner, distinct branch and linked PR, dependencies, relevant repositories and SUT contract version, OpenSpec/ADR, positive and negative acceptance tests, last pushed SHA, actual environment/results and one next action. Avoid editing another agent's branch. Split work to avoid overlapping paths.
- On interruption leave a dated **handoff** on the Issue: status, owner, links, commit, verified/failed tests, incomplete work, precise blocker and next action. Release ownership if work becomes ready for another agent.

## Delivery, self-review, merge
- Always create a short-lived branch and **draft PR early**. No direct changes to `main`. PR body uses [shared template](../.github/pull_request_template.md) with `Refs #NUMBER`; use `Closes #NUMBER` only for completely accepted work.
- Update OpenSpec proposal/specs/tasks for behavior and automation. Use ADR for architectural/contract/security/release tradeoffs. Docs-only changes can have a minimal OpenSpec change. Tests, screenshots and artifacts must be authentic and reproducible; distinguish fixture, mocked MCP, Wopee live, native Appium, browser tests, compiled builds and real deployment.
- **Act, do not wait passively:** delegate separate correctness, security, test-quality, accessibility and compatibility reviews to independent subagents when available. Record findings and exact reviewed SHA. If not available, explicitly label independent-focus passes **self-review**, never pretend an approval came from another reviewer.
- Fix findings, re-run the actual **current-head** checks, obtain genuinely required GitHub approvals, and **merge proactively** only when all protections, approvals and acceptance gates pass. Do not bypass CI, branch protection, security checks, runner failures or missing device evidence. A self-review is not a substitute for a required GitHub approval.
- After merge verify `main` and merge SHA, update Issue/OpenSpec with evidence, set `status:done` and close only if fully accepted. Delete the merged source branch when GitHub tooling permits; document any branch-cleanup blocker.

## Cross-repo SUT and infrastructure
- For coordinated changes, merge the **tazumo** SUT contract first and pin its version/commit in consumer repositories. Update the downstream cases and compatibility checks explicitly.
- Agent Skills follow [agentskills.io](https://agentskills.io/specification); canonical mobile skills live in `mobile-agent` and are pinned/synced in `mobile-demo`.
- Self-hosted Hetzner Actions must use approved labels, isolate untrusted PR code and avoid exposing write tokens or secrets to tests. A queued or runner-unassigned job is **not evidence of success**.
- No background agents or automatic GitHub Projects synchronization are implied. If the environment cannot execute a required action, record a `status:blocked` Issue with exact human or infrastructure unblocker.
