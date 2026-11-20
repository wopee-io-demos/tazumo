# Tasks

- [x] Contract tests for core fixtures against `contracts/openapi.json`, with negative cases. Local: `pnpm test:contract`, 14/14 pass (Node 22.19, macOS).
- [x] axe accessibility checks on catalogue (four palettes), search results, empty results and cart; baseline linked to #46. Local: `pnpm test:e2e`, 10/10 a11y tests pass; the gate probe proves an unlisted critical violation fails.
- [x] Failure scenarios: no search results, unknown route, cart edge cases. Local: 6/6 pass, no uncaught page errors.
- [x] `test-evidence.yml` uploads report and screenshots on every run. Local `CI=1 pnpm test:e2e` writes `playwright-report/` and 20 screenshots under `test-results/`.
- [x] ADR-0010: test pyramid and native automation choice.
- [ ] Current-head CI green and independent review recorded.
- [ ] Merged; merge SHA recorded in #9.
