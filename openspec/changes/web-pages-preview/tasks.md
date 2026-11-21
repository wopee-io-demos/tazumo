# Tasks

- [x] Pages enabled with `gh api -X POST repos/wopee-io-demos/tazumo/pages -f build_type=workflow`: `build_type: workflow`, `cname: null`; GitHub created the `github-pages` environment with a `main`-only branch policy. Recorded on #10.
- [x] Local Pages build: `TAZUMO_WEB_BASE=/tazumo/ pnpm build` emits `/tazumo/assets/index-*.js`; plain `pnpm build` emits `/assets/index-*.js`.
- [x] Local smoke against `vite preview` at `http://127.0.0.1:4316/tazumo/`: search, add to cart, disabled checkout and the `#/product/flowers` deep link pass. The `(demo)` title and `noindex` checks are not in the smoke yet because #97 / PR #126 is not on `main`.
- [x] `node scripts/check-runner-guard.mjs` passes for 20 jobs; a probe that lets the deploy job run on pull requests fails with "runs on pull_request with write permissions". `actionlint` is clean.
- [x] `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (38 passed) green locally.
- [x] Review fixes (independent review on a424772): workflow-level concurrency for push/dispatch so each smoke checks its own build; deploy and smoke only from `refs/heads/main`; the smoke fails on any same-origin response >= 400; trailing slash added to `PAGES_URL`; shared locators; job status in the summary. Against a plain static server (no SPA fallback, like Pages) at `http://127.0.0.1:4318/tazumo/` the smoke passes 3/3; with the CSS file deleted it fails on `404 .../tazumo/assets/index-*.css`.
- [ ] First deploy from `main` and green live smoke (run URL recorded on #10 after merge).
