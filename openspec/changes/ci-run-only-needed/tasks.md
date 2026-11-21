# Tasks

- [x] Classifier `scripts/ci-changes.mjs` with 11 unit tests (`node --test scripts/ci-changes.test.mjs`, pass locally).
- [x] Gate steps in `ci.yml`, `test-evidence.yml`, `security.yml` and `codeql.yml`; move Playwright to `evidence`; keep `Secret scan` unchanged.
- [x] Tighten paths in `api.yml`, `backoffice.yml`, `screenshots.yml` (separate web and native jobs) and `demo-videos.yml`.
- [x] PR-only cancel-in-progress with SHA groups outside pull requests on every workflow except `native-builds.yml` (#128).
- [x] `actionlint` clean; `node scripts/check-runner-guard.mjs` passes for 18 jobs.
- [ ] Real CI: full run on this PR; docs-only, web-only and api-only demonstration PRs against this branch; skipped versus run steps and timings recorded.
- [ ] Independent review recorded.
