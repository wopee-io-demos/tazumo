# Tasks

- [x] Contract tests for core fixtures against `contracts/openapi.json`, with negative cases. Built on `apps/api` `buildSeed()` after #49 merged. Local: `pnpm test:contract`, 15/15 pass (Node 22.19, macOS).
- [x] axe accessibility checks on catalogue (four palettes), search results, empty results and cart; baseline linked to #46. Local: `pnpm test:e2e`, 10/10 a11y tests pass; the gate probe proves an unlisted critical violation fails.
- [x] Failure scenarios: no search results, unknown route, cart edge cases. Local: 6/6 pass, no uncaught page errors.
- [x] `test-evidence.yml` uploads report and screenshots on every run. Local `CI=1 pnpm test:e2e` writes `playwright-report/` and 20 screenshots under `test-results/`.
- [x] ADR-0010: test pyramid and native automation choice.
- [x] Independent review recorded in PR #51 (two passes, e9de057 and 6ac8423; findings fixed or filed as #55).
- [x] Current-head CI green on 14a41fb: Quality checks, Test evidence (report and screenshot artifacts), API integration, dependency review and native compile builds all pass (runs 44813210938, 44813210942, 44813210992, 44813210993, 44813210939).
- [x] Merged as 7adf2f7 (PR #51); merge SHA recorded in #9.
- [ ] Native iOS simulator and Android emulator smoke paths (ADR-0010; next slice, not part of this change).
