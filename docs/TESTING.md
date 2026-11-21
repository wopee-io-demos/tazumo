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
| Native smoke | not implemented yet | See ADR-0010 | native simulator/emulator |

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

The path-filtered workflows (`api.yml`, `backoffice.yml`, `screenshots.yml`, `demo-videos.yml`) start only for the files they use, and `screenshots.yml` runs its web and native jobs separately. `native-builds.yml` has its own scope (see its section). Superseded runs of the same pull request are cancelled; runs on `main` are never cancelled, except in `native-builds.yml` until #128 lands.

## CI evidence

[`test-evidence.yml`](../.github/workflows/test-evidence.yml) runs all Playwright specs on every push to `main` and on pull requests that change the web app, packages, e2e tests or contracts. Those runs upload two artifacts, pass or fail:

- `playwright-report`: the HTML report. Each accessibility test carries its axe JSON and a full-page screenshot as attachments; every test has a final screenshot.
- `playwright-test-results`: raw screenshots, plus traces for failed attempts.

This is browser evidence against fixture data. It is not native device evidence and not a deployed environment.
