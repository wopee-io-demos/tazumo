# Testing

How Tazumo is tested, what each layer proves and where the evidence is. The pyramid and the native automation choice are recorded in [ADR-0010](adr/0010-test-pyramid-native-automation.md).

## Commands

```sh
pnpm install
pnpm test                               # core unit tests + contract tests
pnpm test:contract                      # contract tests only
pnpm exec playwright install chromium
pnpm test:e2e                           # all Playwright specs
PLAYWRIGHT_PORT=4194 pnpm test:e2e      # use another port when 4173 is taken
pnpm exec playwright show-report        # open playwright-report/
```

Playwright starts the Vite dev server itself. Locally it reuses a server already listening on the port, so pick a free `PLAYWRIGHT_PORT` when another worktree serves 4173.

## Layers

| Layer | Location | What it proves | Evidence class |
| --- | --- | --- | --- |
| Unit | `packages/core/src/*.test.ts` | Catalogue filtering, cart arithmetic, localization | fixture/unit |
| Contract (projection conformance) | `tests/contract/` | The synthetic catalogue in `@tazumo/core`, seeded with the API's `buildSeed()` and mapped to response shape, fits the `Market`, `Product`, `Merchant` and response schemas in `contracts/openapi.json`, and every product links to a merchant; malformed products are rejected | fixture/unit |
| Browser E2E | `tests/e2e/marketplace.spec.ts`, `tests/e2e/regression.spec.ts` | Category, search, cart, palette and language journeys, plus failure scenarios | browser (Chromium) |
| Accessibility | `tests/e2e/a11y.spec.ts` | No serious or critical axe violations outside the baseline on the catalogue (all four palettes), search results, empty results and the cart | browser (Chromium) |
| Web sign-in | `tests/web-auth/` (real Keycloak, Mailpit and API, run by `idp.yml`), `tests/e2e/auth.spec.ts` (build without a provider) | Sign-up with e-mail verification, sign-in, `GET /v1/me` state, RP-initiated sign-out, forgot password, refresh, rejected callbacks, no token in storage, URL or console | browser (Chromium) against the real IdP |
| Native smoke | `apps/mobile/tests/android-smoke.case.json`, run by `native-builds.yml` `Android emulator smoke` | Browse, product detail, add, cart, subtotal and disabled checkout on an Android emulator, addressed by `sut-` IDs (ADR-0010). iOS was verified locally only (#45). | native emulator |

Contract tests build the seed from `@tazumo/core` with `buildSeed()` from `apps/api/src/fixtures.ts`, the same function that seeds the API database, so identifiers and slugs match the reference API. `tests/contract/openapi.mts` then maps seed rows to the response shape that `apps/api/src/routes/catalogue.ts` selects in SQL (EUR `Money`, `available: true`, merchants with `acceptingOrders: false`, no delivery estimate, `synthetic: true`). This keeps the check database-free; the API's own tests validate live responses against the same contract with PostgreSQL. If the SQL response shape changes, update the mapping too.

## Failure scenarios

- **No search results:** the empty-state status appears, no product cards render, clearing the query restores the catalogue, and a whitespace-only query is not treated as a search.
- **Unknown route:** the SPA fallback renders the app shell without page errors and the home link leads back to the catalogue. There is no dedicated not-found view yet.
- **Cart edge case:** decrementing one of two lines to zero removes only that line, counts never go negative, the subtotal follows, checkout stays disabled, and the cart survives filtering its products out of view.

## Accessibility baseline

`tests/e2e/a11y-baseline.json` lists the serious and critical violations that are known and tracked. A scan fails when a serious or critical rule is not listed for that scan, when its impact differs, when it hits a different number of nodes than `nodes`, or when a listed rule no longer occurs. So the fixing PR must remove or lower the entry, and the baseline can only shrink. The match is by rule and node count, not by element, because CSS selectors break on unrelated markup changes; a fix in one place combined with a new failure of the same rule elsewhere on the same scan is the one case it does not catch. Every entry must link a Tazumo issue. Current entries: [#46](https://github.com/wopee-io-demos/tazumo/issues/46), colour contrast of the hero disclaimer and the cart line price.

## Locators

Use roles and accessible names, or `data-testid` / `testID` values from the SUT contract. Do not use CSS classes, DOM positions or text offsets. Shared helpers are in `tests/e2e/support/locators.ts`.

## CI scope per pull request

The required checks (`check`, `evidence`, `dependency-audit`, `CodeQL PR analysis`, `Secret scan`) run on every pull request, because branch protection waits for them. Their workflows are never path-filtered. Each job starts with `node scripts/ci-changes.mjs`, which reads `git diff HEAD^1 HEAD` on the PR merge commit and gates the expensive steps:

| Changed files | `check` | `evidence` | `dependency-audit` | `CodeQL PR analysis` |
| --- | --- | --- | --- | --- |
| Docs only (`*.md`, `docs/**`, `openspec/**`) | policy and OpenAPI checks only | skipped steps, reports success | skipped | skipped |
| `apps/web/**`, `packages/**`, `tests/e2e/**`, `contracts/**`, `playwright.config.ts` | install, typecheck, unit and contract tests, web build | Playwright e2e and report | only if a `package.json` changed | analysis |
| `apps/mobile/**`, `packages/core/**`, `packages/brand/**` | the above plus `pnpm bundle:mobile` | e2e only for package changes | as above | analysis |
| Other code (for example `apps/api/**`) | install, typecheck, unit and contract tests | skipped | as above | analysis when JS/TS, HTML, JSON or YAML outside `.github/workflows` changed |
| Root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, root `tsconfig*.json`, `ci.yml`, `test-evidence.yml`, `security.yml`, `codeql.yml`, the classifier | everything | everything | audit | analysis |

Playwright runs once per pull request, in `evidence`; `check` no longer runs it. The runner guard runs in `evidence` when a workflow changes. Pushes to `main`, schedules, manual runs and pull requests into any branch other than `main` always run everything. `Secret scan` always scans the PR's commits.

The path-filtered workflows (`api.yml`, `backoffice.yml`, `screenshots.yml`, `demo-videos.yml`, `idp.yml`, `payments.yml`) start only for the files they use; `screenshots.yml` selects its web and native captures with `tests/screenshots/scope.sh` (#157). `native-builds.yml` has its own scope (see its section). Superseded runs of the same pull request are cancelled; runs on `main` are never cancelled, except in `native-builds.yml` and the deploy queue in `pages.yml`.

## Native CI scope

- **JavaScript and shared packages:** the required `check` job runs `pnpm bundle:mobile` on every PR that changes `apps/mobile/**`, `@tazumo/core`, `@tazumo/brand` or the install files. It builds the iOS and Android JS bundles with Expo, so changes to `apps/mobile/src`, `@tazumo/core` and `@tazumo/brand` are compiled for both platforms there.
- **Native layer:** on pull requests, `native-builds.yml` runs the Gradle (`Android debug APK`) and Xcode (`iOS simulator build`) builds only for native-layer changes. The `changes` job decides, from this list:
  - `apps/mobile/app.json`, `package.json` and `eas.json`;
  - `apps/mobile/assets/**` and `apps/mobile/plugins/**`;
  - `babel.config.*` and `metro.config.*`;
  - `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `.npmrc`;
  - the workflow itself.
- **Runtime:** `Android emulator smoke` also runs for `apps/mobile/src/**`, `apps/mobile/tests/**`, `apps/mobile/index.ts` and `packages/core/**`.
- **Out of scope:** other packages and apps do not start the workflow at all.
- **Main:** every push to `main`, the nightly schedule and manual dispatch run all native jobs, so `main` is always verified natively.
- **iOS runner (#144):** the iOS job runs on the self-hosted `mac-ios` runner (`mac-ios-1`) when the repo variable `IOS_RUNNER=self-hosted` is set, or when `RUNNER_MODE` is unset or `self-hosted`. Otherwise it runs on hosted `macos-15`. Pull requests from forks always use `macos-15`, which `scripts/check-runner-guard.mjs` enforces. The trade-off: one self-hosted Mac serialises iOS builds, but it avoids the hosted macOS queue.

## CI evidence

[`test-evidence.yml`](../.github/workflows/test-evidence.yml) runs all Playwright specs on every push to `main` and on pull requests that change the web app, packages, e2e tests or contracts. Those runs upload two artifacts, pass or fail:

- `playwright-report`: the HTML report. Each accessibility test carries its axe JSON and a full-page screenshot as attachments; every test has a final screenshot.
- `playwright-test-results`: raw screenshots, plus traces for failed attempts.

This is browser evidence against fixture data. It is not native device evidence and not a deployed environment.

## Pages preview

[`pages.yml`](../.github/workflows/pages.yml) deploys the web build to https://wopee-io-demos.github.io/tazumo/ on every push to `main` that touches `apps/web`, `packages/`, the root manifests (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`), `tests/pages/` or the workflow, and on manual dispatch from `main`. Push and dispatch runs share one concurrency group that queues and never cancels a running deploy or smoke, so each smoke checks its own build. The preview is a project site under `/tazumo/`, so only this build sets `TAZUMO_WEB_BASE=/tazumo/`, which `apps/web/vite.config.ts` uses as Vite's `base`. Unset, the base is `/`: `pnpm dev:web`, `pnpm build`, `vite preview` and every other CI job are unchanged. Routes are hash routes ([ADR-0012](adr/0012-hash-client-routes.md)), so deep links such as `/tazumo/#/product/flowers` load `index.html` directly and need no 404 fallback.

After the deploy, the `smoke` job waits until the live URL serves the entry script of this build, then runs `tests/pages/smoke.spec.ts` against it: the visible demo labelling (the `(demo)` title and `noindex` checks join when #97 / PR #126 is on `main`), search, add to cart, disabled checkout and a hash deep link. Screenshots are in the `pages-smoke` artifact. This is deployed evidence against synthetic fixture data. On pull requests that change the workflow, the Vite config or the smoke, only the build job runs.

Reproduce the smoke against a local build:

```sh
TAZUMO_WEB_BASE=/tazumo/ pnpm build
TAZUMO_WEB_BASE=/tazumo/ pnpm --filter @tazumo/web exec vite preview --host 127.0.0.1 --port 4316 --strictPort &
PAGES_URL=http://127.0.0.1:4316/tazumo/ pnpm exec playwright test -c tests/pages/playwright.config.ts
PAGES_URL=https://wopee-io-demos.github.io/tazumo/ pnpm exec playwright test -c tests/pages/playwright.config.ts
```
