# Releasing Tazumo and verifying a deployment

The Tazumo SUT (web, mobile and API) has one product version, released as `vX.Y.Z` tags with a GitHub Release and a [CHANGELOG](../CHANGELOG.md) entry. The two contracts have their own versions. Decision and alternatives: [ADR-0028](adr/0028-versioning-model.md).

| What | Version source | Enforced by |
| --- | --- | --- |
| Product (SUT) | `.release-please-manifest.json`, mirrored into the root and `apps/*` `package.json` and `apps/mobile/app.json` | release-please; `tests/contract/versioning.test.mts` checks they agree |
| SUT contract | `contracts/sut.json` `version` | `pnpm check:sut --base <ref>` |
| OpenAPI contract | `contracts/openapi.json` `info.version` | `pnpm check:openapi --base <ref>` |
| Native build number | `TAZUMO_BUILD_NUMBER` (CI: `github.run_number`), default `1` | `apps/mobile/app.config.js` |

## How a release happens

1. Merge PRs with Conventional Commit titles as usual. `feat`, `fix`, `perf`, `revert` and `deps` are releasable. `docs`, `test`, `ci`, `build`, `refactor` and `chore` are not.
2. On every push to `main`, [`release.yml`](../.github/workflows/release.yml) runs release-please. It opens or updates one release PR, titled `chore(main): release X.Y.Z`, that bumps every version file and prepends the changelog entry.
3. When you want a release, close and reopen the release PR. It is opened with the workflow token, and GitHub starts no workflows for that token's events, so reopening is what runs the required checks on its current head. Every later push to `main` updates the PR again, so reopen it right before merging.
4. When the required checks pass, squash-merge it. Never push to `main` directly; the ruleset forbids it.
5. The next `release.yml` run tags the merge commit `vX.Y.Z` and publishes the GitHub Release with the changelog entry. The Pages workflow redeploys the web preview because `package.json` changed, so `version.json` reports the new version.

Version bumps before 1.0: a feature or a breaking change bumps the minor version, a fix bumps the patch version. To force a version (for example `1.0.0`), add a `Release-As: 1.0.0` footer to a commit on `main`.

A PR that changes `contracts/openapi.json` must raise `info.version` in the same PR (additive change: next minor). A PR that changes `contracts/sut.json` follows [SUT-CONTRACT](SUT-CONTRACT.md).

Repository prerequisite: Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" must be on, or release-please cannot open the release PR.

## Build identity

Every web build serves `version.json` next to `index.html`:

```json
{
  "version": "0.1.0",
  "commit": "c7514b0dc3b6c32d6fcbe81682bad79e9fc899e2",
  "builtAt": "2026-11-21T10:16:45.927Z",
  "contracts": { "sut": "0.2.0", "openapi": "0.7.0-draft" }
}
```

- `version` is the last released product version, from the manifests. Builds between releases keep it, so use `commit` to identify a build exactly. A build of a tagged release has `commit` equal to the tag's commit.
- `commit` is the source commit: `TAZUMO_COMMIT`, then `GITHUB_SHA`, then `git rev-parse HEAD`, and `unknown` when none of them is a full 40-character SHA. It is never empty.
- `index.html` carries the same values as `<meta name="tazumo-version">` and `<meta name="tazumo-commit">`.
- The dev server (`pnpm dev:sut`) serves `/version.json` too.
- The API's `GET /health` returns `version` and `commit`. Set `TAZUMO_COMMIT` to the deployed commit when starting the service; otherwise it reports `unknown`.

The Pages workflow checks `version.json` against `package.json` and the built commit before upload, and its live smoke checks the deployed `version.json` and meta tags.

## Verifying a deployment as a consumer

Pin a SUT contract version (compatibility) and, if you need an exact build, a Tazumo commit or release tag. Before running tests:

```sh
info=$(curl -fsS "${TAZUMO_BASE_URL%/}/version.json?v=$(date +%s)")
echo "$info" | jq -e --arg sut "$PINNED_SUT_CONTRACT" '.contracts.sut == $sut'
echo "$info" | jq -e --arg c "$PINNED_TAZUMO_COMMIT" '$c == "" or .commit == $c'
```

- The query string avoids a stale CDN copy; GitHub Pages caches for up to 10 minutes.
- A contract mismatch means the deployment is not the SUT your tests were written for. Do not run against it.
- `commit` = `unknown` means the build cannot be identified. Treat it as a mismatch when you pinned a commit.
- For the API, check `GET /health` the same way (`.version`, `.commit`).
