# CI runs only the jobs a change needs

## Why
Issue [#134](https://github.com/wopee-io-demos/tazumo/issues/134). Every pull request ran the full pipeline, whatever it changed. Playwright ran twice, in `check` and in `evidence`. A docs-only PR installed dependencies, built the web app, bundled mobile and ran e2e. Path-filtered workflows started heavy native jobs for unrelated package changes.

## What Changes
- `scripts/ci-changes.mjs` classifies the PR's changed files, with unit tests in `scripts/ci-changes.test.mjs`. Pull requests into `main` get categories. Other events, pull requests into other branches (stacked PRs can be retargeted without a re-run) and empty diffs run everything. Root install files, the required workflows and the classifier itself also run everything.
- The required workflows (`ci.yml`, `test-evidence.yml`, `security.yml`, `codeql.yml`) stay unfiltered at the trigger. Each job always runs and gates its expensive steps on the categories.
- Playwright moves out of `check`; `evidence` owns e2e and its report. Contract tests run once, in `check`.
- `api.yml`, `backoffice.yml` and `demo-videos.yml` trigger on what each really imports: `@tazumo/commerce` is added for the API and back office, and Markdown and test files are dropped. `screenshots.yml` keeps the capture scoping from #157 and gets the concurrency rule only.
- Every workflow cancels superseded PR runs and never cancels runs on `main`: the concurrency group uses the commit SHA outside pull requests.
- Out of scope: `native-builds.yml` (#128) and the install lines (#101).

## Impact
A docs-only PR skips install, build, bundling, e2e, the audit and CodeQL analysis, and still reports every required check. The dependency audit on PRs runs only when a manifest changes; pushes to `main` and the weekly schedule still audit everything.
