# Development guidance

1. Start with the linked GitHub Issue. Include acceptance criteria and use one PR per coherent change.
2. Use OpenSpec's spec-driven flow in `openspec/changes/<slug>`: proposal, spec deltas, design, tasks. Update tasks to reflect tested work, not intentions.
3. Capture architectural trade-offs as numbered ADRs, status proposed/accepted/superseded.
4. Reuse `@tazumo/core` for domain logic and `@tazumo/brand` for independently changeable brand tokens. Do not couple user identity, currency or region to the brand name.
5. Do not ship mock courier positions, payments, fees or ETAs as real. The MVP is demonstrative.
6. Never commit secrets, customer data, .env files, EAS credentials or private repository tokens.
7. Require accessibility and language checks before marking customer-facing features complete. Prefer functional usability over mascot decoration.
8. Link pull requests and commits to relevant issues. Prefer draft PRs until CI and native builds have evidence.

## Multi-agent collaboration and fresh-context recovery

Read [docs/START-HERE.md](docs/START-HERE.md) before any new work, then [docs/ISSUE-WORKFLOW.md](docs/ISSUE-WORKFLOW.md). Always select/claim a detailed ready Issue first, verify its assignee and competing PRs, publish a branch/PR linked to that issue, and record your latest pushed SHA, actual test/CI evidence, OpenSpec and ADR decisions and concrete handoff action in the Issue. A fresh agent must not need to read a private chat to resume. Never silently claim another agent's issue or edit their active branch. Use `status:*` issue labels after bootstrap, otherwise explicitly record the status in the Issue body; do not pretend labels are configured. Reviewer agents may review independently, but must not fabricate approvals or bypass failing gates. Merge verified PRs proactively, record merge SHA, then delete branches where permitted and close Issue only when accepted.

## Mandatory shared engineering policy
Read [docs/ENGINEERING-POLICY.md](docs/ENGINEERING-POLICY.md) for issue-first parallel agents, independent PR branches, OpenSpec/ADR, proactive review, genuine CI gates, merge and handoff. [Fresh-start entry](docs/START-HERE.md).

## Reusable Agent Skills

Follow [docs/AGENT-SKILLS.md](docs/AGENT-SKILLS.md), based on https://agentskills.io/specification. This includes metadata-driven SKILL.md, progressive disclosure, source trust and versioned skill copies. Track adoption in issue #35. Use the same issue-linked, reviewed PR delivery gates described above.


## Organization Agent Skills standard
Follow https://agentskills.io/specification for reusable agent procedures. Skills are folders containing `SKILL.md` with valid YAML `name` and task-triggering `description`. Use kebab-case names matching the folder, concise progressive-disclosure instructions, and relative `references/`, `scripts/`, `assets/` when useful. Keep `AGENTS.md` for repo-wide policy; do not confuse it with a skill. Validate using `skills-ref validate <skill-folder>` where available, plus meaningful behavior/negative tests. Changes to reusable skills require linked Issues, OpenSpec and PRs; update the upstream `mobile-agent` skills first, then version and synchronize copies to `mobile-demo` with the lockfile. Never claim Wopee MCP or native device validation from mocked results.

