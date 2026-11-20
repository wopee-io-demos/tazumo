# Start here: tazumo

This is the durable onboarding entry point for a new agent, maintainer or a resumed conversation. **Read live GitHub status, not an older chat transcript or cached checklist.**

## Project purpose
Canonical SUT, a React/Vite web app plus Expo iOS/Android app in a pnpm TypeScript monorepo. Shared @tazumo/core catalogue/cart data and @tazumo/brand tokens. Source of truth for SUT identifiers and fixture version is contracts/sut.json in PR #33 until merged. Draft PR #30 publishes org testing artifacts. Screenshot work is Issue #37. Never claim checkout, payments, merchants, real tracking or native device screenshots are live without evidence.

## Fast navigation
1. [Issue lifecycle, claiming and handoffs](ISSUE-WORKFLOW.md).
2. [Current Issues](https://github.com/wopee-io-demos/tazumo/issues?q=is%3Aissue+is%3Aopen) and [Pull Requests](https://github.com/wopee-io-demos/tazumo/pulls).
3. [GitHub Actions](https://github.com/wopee-io-demos/tazumo/actions) for **current-head** evidence.
4. [Root AGENTS.md](../AGENTS.md) for engineering, Agent Skills, review, merge and safety policy.
5. [README.md](../README.md), [OpenSpec](../openspec/) and relevant [ADRs](../docs/adr/) where available.
6. [Parallel agent governance issue #38](https://github.com/wopee-io-demos/tazumo/issues/38) and its linked PR.

## How to resume safely
```bash
gh auth status
gh repo view --json nameWithOwner
gh issue list --state open --limit 100
gh pr list --state open
# After the status labels have been bootstrapped:
bash scripts/issue-status.sh board
```
Read each issue's latest comments, assigned owner, branch and PR. The newest `status:ready` **unassigned** issue with explicit acceptance criteria is the safest next work item. If labels are not yet installed, read the issue's "Agent status" field and ask the maintainer to run the documented bootstrap. Do not assume the repository's `main` has a pending feature just because a branch exists.

## Reproduce setup / tests
```bash
corepack enable && pnpm install && pnpm dev:sut
pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```
Some live Wopee/Appium actions need secrets or devices. **Offline tests do not count as genuine SUT execution.** Record exactly which checks executed and their results, not only the commands.

## Known dependencies and limits
Requires browser for web captures, Android SDK/emulator for APK, and macOS/Xcode simulator for iOS. Check GitHub Actions workflow runs and current PR heads before asserting builds work.

## Relevant work
[SUT integration #32](https://github.com/wopee-io-demos/tazumo/issues/32), [Screenshots #37](https://github.com/wopee-io-demos/tazumo/issues/37), [Packages #29](https://github.com/wopee-io-demos/tazumo/issues/29), [Architecture ADRs](../docs/adr/README.md)

## Change delivery
Create/claim a GitHub Issue first, write linked OpenSpec changes, work on a new short-lived branch, open a draft PR early, run separated reviews (delegated where available), merge when CI and policy genuinely permit, and update the issue with the merge SHA. For interrupted work, use the handoff template in [ISSUE-WORKFLOW](ISSUE-WORKFLOW.md) with a concrete next step.

This page is intentionally mostly stable. **GitHub Issues/PRs are the live status source**; update their bodies/comments for every new step rather than keeping duplicated static progress tables.
