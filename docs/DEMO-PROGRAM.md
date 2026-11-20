# Wopee Demo Organization: start here

**Purpose:** Five connected repositories demonstrate Wopee's complete testing lifecycle using **Tazumo as the same system under test (SUT)**. New developers and AI agents can resume from live Issues, PRs, OpenSpec and CI, not conversation history.

## Repositories and roles

| Repository | Responsibility | Live work |
| --- | --- | --- |
| [tazumo](https://github.com/wopee-io-demos/tazumo) | Canonical React/Vite web and Expo iOS/Android SUT, fixtures, selectors and contracts | [Issues](https://github.com/wopee-io-demos/tazumo/issues), [PRs](https://github.com/wopee-io-demos/tazumo/pulls), [CI](https://github.com/wopee-io-demos/tazumo/actions) |
| [mobile-agent](https://github.com/wopee-io-demos/mobile-agent) | Canonical Agent Skills for setup, authoring, maintenance and execution | [Issues](https://github.com/wopee-io-demos/mobile-agent/issues), [PRs](https://github.com/wopee-io-demos/mobile-agent/pulls), [CI](https://github.com/wopee-io-demos/mobile-agent/actions) |
| [mobile-demo](https://github.com/wopee-io-demos/mobile-demo) | Tazumo iOS/Android Appium and Wopee-driven native automation demonstration | [Issues](https://github.com/wopee-io-demos/mobile-demo/issues), [PRs](https://github.com/wopee-io-demos/mobile-demo/pulls), [CI](https://github.com/wopee-io-demos/mobile-demo/actions) |
| [web-demo](https://github.com/wopee-io-demos/web-demo) | Wopee hosted web agent lifecycle against Tazumo | [Issues](https://github.com/wopee-io-demos/web-demo/issues), [PRs](https://github.com/wopee-io-demos/web-demo/pulls), [CI](https://github.com/wopee-io-demos/web-demo/actions) |
| [web-demo-pw-cli](https://github.com/wopee-io-demos/web-demo-pw-cli) | Wopee case authoring with Playwright CLI browser execution against Tazumo | [Issues](https://github.com/wopee-io-demos/web-demo-pw-cli/issues), [PRs](https://github.com/wopee-io-demos/web-demo-pw-cli/pulls), [CI](https://github.com/wopee-io-demos/web-demo-pw-cli/actions) |

## Safely start or resume an independent agent

1. Read the target repo's `docs/START-HERE.md`, `AGENTS.md`, and `docs/ISSUE-WORKFLOW.md`. Follow [Agent Skills](https://agentskills.io/specification) where relevant.
2. Read **live** GitHub Issues, latest comments, labels, assignees, PRs and current-head checks. Documentation here is navigation, not a frozen status dashboard.
3. Pick an **unassigned** `status:ready` issue with acceptance criteria and no incompatible PR; claim it and re-read the claim immediately to detect races. Avoid modifying another agent's branch.
4. Record a durable issue handoff packet: scope, owner, branch, PR, SUT contract version, OpenSpec change, ADR, dependencies, tested SHA, artifact URLs, blockers and one exact next action.
5. Implement issue → OpenSpec → focused PR → independent/delegated review when available → validated CI and real device/browser evidence → merge when required GitHub gates permit → delete branch → update issue state. Never fake Wopee MCP, Appium or package publication.
6. If blocked, change status to `status:blocked`, state precisely why and what unblocks it; leave other unassigned Ready issues for new teams.

## Coordination contract

- One status label per issue: `status:backlog`, `status:ready`, `status:in-progress`, `status:in-review`, `status:blocked`, `status:done`.
- Prefer one active issue per assignee/agent and one branch per issue. Multiple agents can own **different independent Issues** in parallel.
- Tazumo owns `contracts/sut.json`. Merge an upstream versioned contract change first, then update consumer repositories against that exact commit/version. Avoid a PR that silently depends on an unmerged SUT selector.
- Source of Agent Skills is `mobile-agent/skills`. Copies in `mobile-demo/.agents/skills` are pinned by `skills.lock.json`; synchronize via upstream-first PRs.
- Run `bash scripts/issue-status.sh audit` inside any repository with that helper to detect contradictory states. It is **read-only** and intentionally does not steal issue ownership.
- A failed or queued GitHub Actions job never satisfies an acceptance gate. Hetzner self-hosted runners require verified permissions and isolation for untrusted PR code.

## Canonical demonstrations

All web/native demos cover **setup**, **test authoring**, **test maintenance**, **test execution**, and preserve screenshots/logs as evidence. Fixture/mocked checks are development proofs, not equivalent to Wopee hosted execution or real devices.

## Current program checkpoints, read live before acting

- [Tazumo contract work](https://github.com/wopee-io-demos/tazumo/issues/32)
- [App screenshots](https://github.com/wopee-io-demos/tazumo/issues/37)
- [GitHub package publishing](https://github.com/wopee-io-demos/tazumo/issues/29)
- [Parallel governance](https://github.com/wopee-io-demos/tazumo/issues/40)
- [Board health follow-up](https://github.com/wopee-io-demos/tazumo/issues/42)

Read links and current comments to determine whether these are still open; no state snapshot is authoritative.
