# Tasks

- [x] Classifier `scripts/ci-changes.mjs` with 13 unit tests, including a temporary git repo with a merge commit, a rename and a deletion (`node --test scripts/ci-changes.test.mjs`, pass locally).
- [x] Gate steps in `ci.yml`, `test-evidence.yml`, `security.yml` and `codeql.yml`; move Playwright to `evidence`; keep `Secret scan` unchanged.
- [x] Tighten paths in `api.yml`, `backoffice.yml` and `demo-videos.yml`. `screenshots.yml` takes #157's scoping from `main`, plus the concurrency rule.
- [x] PR-only cancel-in-progress with SHA groups outside pull requests on every workflow except `native-builds.yml` (#128).
- [x] `actionlint` clean; `node scripts/check-runner-guard.mjs` passes for 18 jobs.
- [x] Demonstration PRs against this branch, with the classifier at 2c415b4 (same category rules; later commits added commerce paths, the stacked-PR rule and tests). All five required checks succeeded on each:
  - #141 docs only: check 7s (policy and OpenAPI only), evidence 7s, dependency-audit 8s, CodeQL 12s (skipped), Secret scan 8s. Baseline #121: 87s, 49s, 16s, 69s.
  - #142 web only: check 35s (install, typecheck, tests, build; no `bundle:mobile`), evidence 51s (e2e), dependency-audit 6s, CodeQL 5s (CSS only, skipped). Baseline #81: 105s, 60s, 20s.
  - #143 api only: check 29s (install, typecheck, tests; no build or bundle), evidence 8s (no e2e), dependency-audit 8s, CodeQL 74s (analysis), api 42s, backoffice 72s. Baseline #129: 97s, 58s, 25s, 68s.
- [x] Independent review: pass 1 on 2c415b4 (1 major, 5 minor, 3 nits), pass 2 on a83966c (all resolved, 3 nits), nits fixed in 1c1ea72.
- [ ] Full run green on the PR head; merge SHA recorded in #134.
