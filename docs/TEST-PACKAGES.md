# Organization testing packages

The monorepo has **two opt-in, private-by-default test distribution paths** through GitHub Packages. PRs run package and container smoke checks but never publish. A reviewed merge to `main` that changes packaging inputs automatically publishes both test package types; maintainers can also manually trigger the workflow from `main`.

## 1. Web preview image in GitHub Container Registry

Package: `ghcr.io/wopee-io-demos/tazumo-web`

GitHub UI: `https://github.com/orgs/wopee-io-demos/packages`. Under the `tazumo-web` package, check package visibility and Actions access. The Dockerfile links the source repo with an OCI label. No real orders or payments are supported.

Run after a successful publication:

```sh
# Authenticate with a token that has read:packages and organization package access.
echo "$GH_PACKAGES_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
docker pull ghcr.io/wopee-io-demos/tazumo-web:test-RUN_NUMBER
docker run --rm -p 8080:8080 ghcr.io/wopee-io-demos/tazumo-web:test-RUN_NUMBER
# Open http://localhost:8080/healthz or http://localhost:8080/
```

Use the `test-<workflow run number>` tag as the immutable test identifier, or `sha-<full commit SHA>` to pin the source revision. These are **not** a production container service and do not host a live customer site.

## 2. npm synthetic test kit

Package: `@wopee-io-demos/tazumo-test-kit`, published as `0.0.<GitHub workflow run number>`, with dist-tag `test`.

Contents are generated from the existing `@tazumo/core` fixture catalogue and `@tazumo/brand` tokens. The package includes ESM entry points, TypeScript declarations and `marketplace.json`; it deliberately contains no secret data, backend credentials, external transactions or real customer information.

To consume from another organization repository, grant that repository **read access under the package's Actions access settings**, then set:

```ini
# .npmrc (never commit credentials)
@wopee-io-demos:registry=https://npm.pkg.github.com
```

```sh
# Locally authenticate to GitHub Packages with read:packages token.
export NODE_AUTH_TOKEN="YOUR_GITHUB_PACKAGES_TOKEN"
npm install --save-dev @wopee-io-demos/tazumo-test-kit@0.0.RUN_NUMBER
```

For CI, use `actions/setup-node@v4` with `registry-url: https://npm.pkg.github.com`, `scope: '@wopee-io-demos'` and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Configure explicit cross-repository Actions package access, as another repository's token is not automatically authorized to private package resources.

```js
import {fixture} from '@wopee-io-demos/tazumo-test-kit';
console.log(fixture.products.length,fixture.brand.palettes);
```

## Publish procedure

1. Merge the workflow and test kit PR to `main` after CI verification. An eligible push to `main` automatically publishes both types after validation.
2. Alternatively open **Actions → Publish organization test packages → Run workflow** on `main`.
3. For a manual run, select web image and/or npm kit. Each publishes separately after verification.
4. Inspect the run output and verify actual package versions in the organization **Packages** page.
5. In package settings, confirm repository linkage, private visibility and team/repo read grants as appropriate. The default behavior may depend on organization settings.
6. Record the successfully published tags/versions and run URLs in issue #29.

The workflow uses an ephemeral `GITHUB_TOKEN` with the narrow required `packages: write` permission. Do not commit personal access tokens.

## Mobile app testing

The existing [Native development builds](https://github.com/wopee-io-demos/tazumo/actions/workflows/native-builds.yml) workflow produces an Android debug APK and a zipped unsigned iOS **Simulator** `.app` as GitHub Actions artifacts. These are not npm or container packages, and the simulator `.app` cannot install on a physical iPhone. Signed iOS device distribution requires Apple developer credentials and provisioning. Android APK remains a debugging artifact, not a published Play Store build.

**Status:** Packaging infrastructure in a PR is not evidence of any published organization package. Check Actions and the org Packages list for confirmation.
