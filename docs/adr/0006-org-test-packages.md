# ADR-0006: GitHub organization packages for test distribution

Status: Proposed
Date: 2026-11-20

## Context
A single pnpm monorepo powers a static web prototype and Expo iOS/Android apps; other organization repositories need repeatable test artifacts. npm packages are appropriate for synthetic fixture/contracts, and OCI images for a runnable static web preview. iOS/Android binaries have separate signing and distribution requirements.

## Decision
- Publish a dedicated `@wopee-io-demos/tazumo-test-kit` npm package to `npm.pkg.github.com`, generated from local shared modules without altering internal `@tazumo/*` imports.
- Publish the static web client as `ghcr.io/wopee-io-demos/tazumo-web` via a build-stage Dockerfile.
- Use a **manual**, main-branch-only workflow, job-scoped `packages:write` `GITHUB_TOKEN`, version tags using workflow run and Git SHA, and pre-publish tests. No publish on untrusted PRs.
- Retain the Android debug APK and iOS Simulator app as GitHub Actions build artifacts. Future physical-device signed binaries are separate release work.
- Initially keep package visibility private and grant access to specific organization teams/repositories only after reviewing controls.

## Consequences
Package installation needs authenticated `read:packages` access for private packages. Publication rights, visibility and organization policies must be verified in GitHub UI after the first run. Publishing does not deploy a real backend or make checkout functional. Track in #29.
