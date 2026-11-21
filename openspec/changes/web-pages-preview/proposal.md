# Public web preview on GitHub Pages

## Why
Issue [#10](https://github.com/wopee-io-demos/tazumo/issues/10), item "Web preview URL with successful smoke test". The repository owner approved a public preview on 2026-11-21 ahead of name clearance (#6). Downstream demos (web-demo#1, `TAZUMO_BASE_URL`) need a stable URL. Decision and alternatives: [ADR-0025](../../../docs/adr/0025-web-preview-github-pages.md).

## What Changes
- `.github/workflows/pages.yml`: build `apps/web` with `TAZUMO_WEB_BASE=/tazumo/`, deploy to GitHub Pages on push to `main` and manual dispatch, then smoke-test the live URL with `tests/pages/smoke.spec.ts` and upload screenshots. On pull requests that touch the workflow, the Vite config or the smoke, only the build runs.
- `apps/web/vite.config.ts`: `base` from `TAZUMO_WEB_BASE`, default `/`.
- Repository setting: Pages enabled with build type "GitHub Actions", no custom domain.
- README preview line, `docs/TESTING.md` section.

## Out of scope
Installable Android/iOS releases, signing, store publishing and release procedures (blocked on #6). Per-PR previews. A custom domain.
