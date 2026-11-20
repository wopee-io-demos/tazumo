# Tasks

- [x] Contract tests for core fixtures against `contracts/openapi.json`, with negative cases. Built on `apps/api` `buildSeed()` after #49 merged. Local: `pnpm test:contract`, 15/15 pass (Node 22.19, macOS).
- [x] axe accessibility checks on catalogue (four palettes), search results, empty results and cart; baseline linked to #46. Local: `pnpm test:e2e`, 10/10 a11y tests pass; the gate probe proves an unlisted critical violation fails.
- [x] Failure scenarios: no search results, unknown route, cart edge cases. Local: 6/6 pass, no uncaught page errors.
- [x] `test-evidence.yml` uploads report and screenshots on every run. Local `CI=1 pnpm test:e2e` writes `playwright-report/` and 20 screenshots under `test-results/`.
- [x] ADR-0010: test pyramid and native automation choice.
- [x] Independent review recorded in PR #51 (two passes, e9de057 and 6ac8423; findings fixed or filed as #55).
- [ ] Current-head CI green after rebase on main.
- [ ] Merged; merge SHA recorded in #9.
