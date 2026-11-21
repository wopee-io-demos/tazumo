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

## Native CI scope

- **JavaScript and shared packages:** the required `check` job runs `pnpm bundle:mobile` on every PR. It builds the iOS and Android JS bundles with Expo, so changes to `apps/mobile/src`, `@tazumo/core` and `@tazumo/brand` are compiled for both platforms there.
- **Native layer:** on pull requests, `native-builds.yml` runs the Gradle (`Android debug APK`) and Xcode (`iOS simulator build`) builds only for native-layer changes. The `changes` job decides, from this list:
  - `apps/mobile/app.json`, `package.json` and `eas.json`;
  - `apps/mobile/assets/**` and `apps/mobile/plugins/**`;
  - `babel.config.*` and `metro.config.*`;
  - `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `.npmrc`;
  - the workflow itself.
- **Runtime:** `Android emulator smoke` also runs for `apps/mobile/src/**`, `apps/mobile/tests/**`, `apps/mobile/index.ts` and `packages/core/**`.
- **Out of scope:** other packages and apps do not start the workflow at all.
- **Main:** every push to `main`, the nightly schedule and manual dispatch run all native jobs, so `main` is always verified natively.

## CI evidence

[`test-evidence.yml`](../.github/workflows/test-evidence.yml) runs the contract tests and all Playwright specs on every pull request and push to `main`, and uploads two artifacts on every run, pass or fail:

- `playwright-report`: the HTML report. Each accessibility test carries its axe JSON and a full-page screenshot as attachments; every test has a final screenshot.
- `playwright-test-results`: raw screenshots, plus traces for failed attempts.

This is browser evidence against fixture data. It is not native device evidence and not a deployed environment.
