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
| Contract | `tests/contract/` | Every synthetic product and merchant in `@tazumo/core` fits the `Product`, `Merchant` and response schemas in `contracts/openapi.json`; malformed products are rejected | fixture/unit |
| Browser E2E | `tests/e2e/marketplace.spec.ts`, `tests/e2e/regression.spec.ts` | Category, search, cart, palette and language journeys, plus failure scenarios | browser (Chromium) |
| Accessibility | `tests/e2e/a11y.spec.ts` | No serious or critical axe violations outside the baseline on the catalogue (all four palettes), search results, empty results and the cart | browser (Chromium) |
| Native smoke | not implemented yet | See ADR-0010 | native simulator/emulator |

Contract tests project the core fixtures into API shape in `tests/contract/openapi.mts`: deterministic UUIDv5 identifiers, `Money` in EUR minor units, `available: true`, merchants with `acceptingOrders: false` and no delivery estimate. The projection lives in the tests because the core fixtures are a UI catalogue, not API payloads.

## Failure scenarios

- **No search results:** the empty-state status appears, no product cards render, clearing the query restores the catalogue, and a whitespace-only query is not treated as a search.
- **Unknown route:** the SPA fallback renders the app shell without page errors and the home link leads back to the catalogue. There is no dedicated not-found view yet.
- **Cart edge case:** decrementing one of two lines to zero removes only that line, counts never go negative, the subtotal follows, checkout stays disabled, and the cart survives filtering its products out of view.

## Accessibility baseline

`tests/e2e/a11y-baseline.json` lists the serious and critical violations that are known and tracked. A scan fails when a rule is not listed for that scan, or when a listed rule hits more nodes than `maxNodes`. Entries that no longer reproduce are reported as `a11y-baseline-stale` annotations in the report; remove them in the fixing PR. Every entry must link a Tazumo issue. Current entries: [#46](https://github.com/wopee-io-demos/tazumo/issues/46), colour contrast of the hero disclaimer and the cart line price.

## Locators

Use roles and accessible names, or `data-testid` / `testID` values from the SUT contract. Do not use CSS classes, DOM positions or text offsets. Shared helpers are in `tests/e2e/support/locators.ts`.

## CI evidence

[`test-evidence.yml`](../.github/workflows/test-evidence.yml) runs the contract tests and all Playwright specs on every pull request and push to `main`, and uploads two artifacts on every run, pass or fail:

- `playwright-report`: the HTML report. Each accessibility test carries its axe JSON and a full-page screenshot as attachments; every test has a final screenshot.
- `playwright-test-results`: raw screenshots, plus traces for failed attempts.

This is browser evidence against fixture data. It is not native device evidence and not a deployed environment.
