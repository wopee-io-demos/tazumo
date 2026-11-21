# Tasks

- [x] Release notes read for checkout v5-v7, setup-node v5-v7, upload-artifact v5-v7, setup-java v5-v6, pnpm/action-setup v5-v6 and cache v5-v6; findings recorded in the proposal.
- [x] Tags resolved to commit SHAs with `git ls-remote` against each action's repository; 67 refs replaced. A grep for `uses:` refs without a 40-character SHA finds none.
- [x] `node scripts/check-runner-guard.mjs`: 26 jobs verified. `node --test scripts/ci-changes.test.mjs`: 13 pass.
- [x] Self-hosted iOS runner version checked: `mac-ios-1` 2.338.2 (job log of run 44924403513).
- [ ] Current-head CI green across every workflow this change triggers.
- [ ] Independent review recorded in the PR.
