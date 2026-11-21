# Product releases, changelog and build identity

## Why
Issue [#159](https://github.com/wopee-io-demos/tazumo/issues/159), absorbing [#120](https://github.com/wopee-io-demos/tazumo/issues/120). The SUT had no tags, releases or changelog, every manifest was a static `0.1.0`, and no deployment said which commit or contract version it was built from, so downstream demos could not verify the SUT they test. Decision and alternatives: [ADR-0028](../../../docs/adr/0028-versioning-model.md).

## What Changes
- One product version in `.release-please-manifest.json`, mirrored into the root and `apps/*` `package.json` and `apps/mobile/app.json`. `v0.1.0` is tagged once by hand as the baseline.
- `release-please-config.json` (manifest mode, one root component, node strategy, extra files) and `.github/workflows/release.yml` (pinned release-please-action, push to `main`, GitHub-hosted, the only job with `contents: write` and `pull-requests: write`). `CHANGELOG.md` seeded with the 0.1.0 baseline.
- `scripts/check-openapi-version.mjs` (`pnpm check:openapi`), run in `ci.yml` next to `check:sut` against the base: the OpenAPI version must be semver and must increase whenever the contract changes.
- `scripts/build-info.mjs` and a Vite plugin: the web build and dev server serve `version.json` with `version`, `commit`, `builtAt` and both contract versions, and `index.html` gets `tazumo-version` and `tazumo-commit` meta tags.
- API `GET /health` returns `version` and `commit` (`TAZUMO_COMMIT`).
- `apps/mobile/app.config.js` sets `ios.buildNumber` and `android.versionCode` from `TAZUMO_BUILD_NUMBER` (default `1`).
- `pages.yml`: checks the built `version.json` against `package.json` and the commit, smoke-tests the deployed one, redeploys on contract changes.
- Docs: `docs/RELEASING.md`, README line, `docs/SUT-CONTRACT.md` pointer, API README.

## Out of scope
Publishing packages, store signing and submission, a GitHub App token for the release PR (checks start by reopening the PR until then), setting `TAZUMO_BUILD_NUMBER` in `native-builds.yml` (owned by the native builds workflow; requested there), downstream verification in web-demo (follow-up issue).
