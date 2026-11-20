# Quality coverage: contract, accessibility, failure scenarios and CI evidence

## Why
Issue [#9](https://github.com/wopee-io-demos/tazumo/issues/9) asks for repeatable web E2E coverage with recorded CI evidence, and native smoke paths. The web suite only covered happy paths, nothing checked the synthetic fixtures against the API contract, accessibility was not checked automatically, and screenshots were uploaded only when a run failed.

## What Changes
- Contract tests validate the `@tazumo/core` fixtures against `contracts/openapi.json` and reject malformed products.
- Automated axe checks on the catalogue, search results and cart, with an explicit, issue-linked baseline.
- Playwright failure scenarios: no search results, unknown route, cart edge cases.
- `test-evidence.yml` uploads the Playwright HTML report and screenshots on every run.
- ADR-0010 records the test pyramid and the native automation choice. Native smoke itself is out of scope here.

## Impact
- Root `package.json` gains `@axe-core/playwright`, `ajv`, `ajv-formats` and a `test:contract` script that `pnpm test` also runs.
- Follow-up [#46](https://github.com/wopee-io-demos/tazumo/issues/46) for the baselined colour-contrast violations (against #3, related #27).
