# ADR-0008: Hetzner self-hosted Linux runners for demo CI

Status: Proposed; runner is **not yet installed or verified**
Date: 2026-11-20

## Context
GitHub-hosted jobs across Tazumo and the demo organization have recently failed before runner assignment (`runner_id: 0`). A Hetzner self-hosted runner is being prepared. We want to run web and Android verification without weakening test isolation and supply-chain safety.

## Decision proposal
- Register one or more **organization-level**, disposable GitHub Actions Linux x64 runner instances in `wopee-io-demos`.
- Apply explicit labels `self-hosted`, `linux`, `x64`, `wopee-demo` to authorized runner group. If your actual labels differ, update the workflow at cutover rather than inventing a name now.
- Initially keep existing `ubuntu-latest` for PR verification to avoid running arbitrary untrusted PR code on a persistent host. Switch guarded trusted-branch jobs to `[self-hosted, linux, x64, wopee-demo]` only after runner onboarding and threat-model review.
- Use **ephemeral runners** in isolated, disposable VMs/containers where feasible, no shared mutable workspace, no persistent repository tokens, and tightly scoped `GITHUB_TOKEN`. Clear workspaces after each job.
- For web builds and E2E, install Node 22/24, pnpm 10, Chromium/Playwright system libraries, Docker engine if building GHCR images. For Android native builds, install JDK 17, Android SDK, matching build tools, and adequate storage.
- Do not run iOS Simulator builds on Hetzner Linux. They require macOS/Xcode. Keep `macos-15` or a dedicated macOS runner.
- Package publishing jobs must run only from trusted `main` (or manually triggered, approved refs), and retain `packages:write` only in the exact publish job. Do not expose privileged registry credentials to fork PR code.
- Separate Wopee credentials and production/customer data from untrusted builds. Put egress constraints, patching, logging, disk quotas and concurrency limits in place.

## Rollout gates
1. Verify runner registration, runner-group repository access, labels and a trivial nonsecret `workflow_dispatch` smoke run.
2. Verify container, Node, pnpm, browser and Android toolchains with real jobs and record artifacts.
3. Enable selected trusted-branch workflows on the Hetzner runner, keep macOS jobs hosted.
4. Verify reproducibility, cleanup between builds, secret boundaries and unexpected failures.
5. Switch PR checks only to genuinely ephemeral untrusted-job isolation after security approval. Document cost and performance before broad rollout.

## Alternatives
- GitHub-hosted Ubuntu for everything except iOS: lower administration burden, but currently blocked or failing to schedule.
- All CI on one persistent self-hosted runner: less setup, but unacceptable risk for arbitrary PR jobs and shared secrets.
- Self-hosted Mac: supports iOS but higher cost and complexity than current macOS-hosted workflows.

## Consequences
Until the user confirms runner labels, capacity, group policy and live Actions execution, **do not switch existing `runs-on` targets or claim that CI is restored**. Track deployment under a dedicated Issue. Keep package publication gated.
