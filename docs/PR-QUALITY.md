# PR quality and review policy

All changes should reference a GitHub Issue and corresponding OpenSpec change (and ADR where architectural).

## Automated checks
- Quality checks: TypeScript, unit tests, production web build, Expo JS exports and Chromium Playwright E2E.
- Dependency security review: fail on high/critical vulnerabilities (`pnpm audit --audit-level high`).
- Native builds: Android debug APK and iOS Simulator .app for changes to shared/native files. Published artifacts expire.
- Repo-policy script validates required documentation and quality scripts.

## Human and assistant review
Review the diff, changes vs requirements, security/privacy, test evidence, maintainability, accessibility, migration and dependencies. Fix blockers before merge. The author checking their own changes is **not independent approval**. Independent review must be performed by another actor or a separately authenticated agent; no autonomous subagent is currently configured through this GitHub integration.

## Merge gate
Verify all applicable checks for the **latest commit SHA**, inspect unresolved review comments and issue criteria, then squash-merge with an expected head SHA. Do not bypass red checks. If branch protection is not configured, this is a documented **process**, not a server-enforced policy. Configure required checks and review requirements in a GitHub branch ruleset with repository admin access. Use Issues #14 and #15 for reproducibility and enforced policy.
