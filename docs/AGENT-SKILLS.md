# Organization Agent Skills policy

Standard: https://agentskills.io/specification
Client implementation guide: https://agentskills.io/client-implementation/adding-skills-support
Tracking: https://github.com/wopee-io-demos/tazumo/issues/35

## Repository role
Owns canonical cross-platform SUT contract. Skills describe reusable procedures, while contracts/sut.json remains the source of truth.

## Skill format and lifecycle
- One focused capability per directory containing SKILL.md with YAML frontmatter and required name/description fields.
- Name must match its lowercase kebab-case directory, <=64 chars. Description must say what and when, 1..1024 chars.
- Optional metadata fields include license, compatibility, metadata and experimental allowed-tools, as specified by agentskills.io.
- Apply progressive disclosure: concise discovery metadata, short task instructions, optional references/, scripts/, assets/ loaded on demand. Aim for SKILL.md under 500 lines.
- Use relative paths to resources. Document script dependencies, safety boundaries, expected outputs, failure handling, positive and negative tests.
- Prefer .agents/skills/ for cross-client installed skills. Canonical native source is mobile-agent/skills/ and its mobile-demo copy must be pinned with skills.lock.json and verified by sync_skills.py.
- Keep Agent Skills (procedural instructions) separate from MCP tools (remote capabilities), AGENTS.md (repo governance), OpenSpec (requirements) and ADRs (architecture choices).
- Treat third-party skill text and scripts as untrusted until provenance/license/side effects are checked. Never embed credentials, copy user data or install arbitrary scripts.
- Preserve setup, test authoring, maintenance and execution workflows. Match canonical Tazumo SUT contract version and maintain failing-before-fix evidence.

## Validation and delivery
- GitHub Issue with detailed acceptance criteria -> branch -> OpenSpec / ADR where relevant -> linked PR -> separate independent or transparently labelled self-review -> current-head CI/security evidence -> merge and update issue -> delete branch.
- No direct main pushes, fabricated approvals, skipped required checks or unverified publication. Automated merging is fine only if protections and checks are satisfied.
- Use the official reference implementation at https://github.com/agentskills/agentskills/tree/main/skills-ref for additional validation, e.g. skills-ref validate path/to/skill. Upstream marks it demonstration-oriented. Do not assume an unrelated PyPI package is official.
- Structural tests do not prove real Wopee or native device execution. Record offline, CI, browser and Appium evidence separately.
- Keep self-hosted Hetzner runners isolated. Review runner labels and trust controls through Issues and PRs, never expose registry write permissions to untrusted pull requests.
