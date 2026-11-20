# Development guidance

1. Start with the linked GitHub Issue. Include acceptance criteria and use one PR per coherent change.
2. Use OpenSpec's spec-driven flow in `openspec/changes/<slug>`: proposal, spec deltas, design, tasks. Update tasks to reflect tested work, not intentions.
3. Capture architectural trade-offs as numbered ADRs, status proposed/accepted/superseded.
4. Reuse `@tazumo/core` for domain logic and `@tazumo/brand` for independently changeable brand tokens. Do not couple user identity, currency or region to the brand name.
5. Do not ship mock courier positions, payments, fees or ETAs as real. The MVP is demonstrative.
6. Never commit secrets, customer data, .env files, EAS credentials or private repository tokens.
7. Require accessibility and language checks before marking customer-facing features complete. Prefer functional usability over mascot decoration.
8. Link pull requests and commits to relevant issues. Prefer draft PRs until CI and native builds have evidence.

## Mandatory Issue → OpenSpec → PR → evidence workflow

**All repository changes must be delivered through pull requests. Never commit directly to `main`**, including documentation, workflows, dependencies, fixtures, tests and agent instructions. Branch from current `main` and keep PRs small enough to review. Do not merge an unrelated change just because a PR is already open.

1. **Issue first.** Before coding, identify an existing GitHub Issue or create a new one. Record the problem and context, desired user/demo behavior, scope and out-of-scope, affected platforms/repositories, explicit acceptance criteria, risks/dependencies and verification plan. For defects capture expected vs actual behavior and reproduction. Link related or blocking issues. Avoid duplicate tracking issues.
2. **Specify before implementing.** For functional/behavior changes create or update an OpenSpec change in `openspec/changes/<slug>/` with proposal, requirements/scenarios, design when helpful, and executable tasks. Link the Issue number in the proposal. Use ADRs for durable architectural trade-offs, with alternatives, consequences, date and status. Minor editorial fixes may reference the Issue without a new ADR or OpenSpec change, but still require a PR.
3. **Implement on a branch, submit a PR.** Use `feat/<issue>-<short-description>` or `fix/<issue>-<short-description>`; opening a draft PR early is encouraged. The PR description must contain `Refs #<issue>` or `Closes #<issue>` as appropriate, summary, changed behavior, OpenSpec/ADR links, test commands and *observed* results, screenshots/artifacts for UI/native changes, migration/rollback notes where relevant, and known limitations. Cross-repository changes must link the paired PRs/issues and the exact Tazumo SUT contract version.
4. **Verify before merge.** Run and report relevant unit, contract, quality, E2E, device, accessibility and security checks. Distinguish mocked/offline tests, browser execution, Appium device runs and live Wopee runs. Never mark a task verified based solely on code written, a queued CI job, or an inferred result. A failed/blocked check stays visible in the PR and Issue; do not silently bypass it.
5. **Review and merge.** Resolve review feedback, confirm required CI checks and approvals, merge via PR only, and delete the merged feature branch. Don't close an Issue until acceptance criteria are verified and linked evidence is recorded. If more work remains, keep it open and document what is pending, or split out a follow-up issue before closure. Update OpenSpec task checkboxes and ADR status as changes land.
6. **Maintain traceability.** PR title/body, commit history, Issues, OpenSpec, ADRs and test artifacts must make it possible to answer: *why did this change happen, what was changed, how was it tested, what is still incomplete, and which SUT version was used?* Record durable links and exact SHA/build or test-run IDs. Do not paste secrets, personal data or sensitive logs into Issues/PRs.

For demo-specific changes, the four required acceptance dimensions are **Setup, Test Authoring, Test Maintenance and Test Execution**. Use `wopee-io-demos/tazumo` as the canonical SUT and keep `contracts/sut.json` version/locators consistent across the five repositories. Any `sut-*` rename requires downstream migration PRs and negative/positive maintenance evidence.
