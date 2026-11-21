# ADR-0025: Public web preview on GitHub Pages

Status: Accepted
Date: 2026-11-21
Issue: [#10](https://github.com/wopee-io-demos/tazumo/issues/10)

## Context
The repository owner decided on 2026-11-21 (recorded on #10) to publish the web app as a public preview before name clearance (#6). Installable app releases stay blocked on #6. The preview must be clearly a demo, not indexed (#97), cost nothing to run, add no secrets and give downstream demos (web-demo `TAZUMO_BASE_URL`) a stable URL. The app is a static Vite SPA with hash routes (ADR-0012).

## Options
1. **GitHub Pages, deployed by an Actions workflow (chosen).** No account, no secret, no custom domain; deploy uses the job's OIDC token with `pages: write`. The `github-pages` environment only accepts `main`. The site is a project site under `/tazumo/`, so the build needs a base path.
2. **Netlify, Vercel or Cloudflare Pages.** Per-PR previews and root-path hosting, but a third-party account and a deploy token stored as a repository secret, which the runner guard and the no-secrets-on-PR rule would have to accommodate.
3. **Self-hosted static server on the demos pool.** Full control, but it puts a public endpoint on shared infrastructure and needs maintenance.

## Decision
Option 1. `.github/workflows/pages.yml` builds with `TAZUMO_WEB_BASE=/tazumo/`, deploys with `actions/configure-pages`, `upload-pages-artifact` and `deploy-pages` pinned to SHAs, and smoke-tests the live URL. Only the deploy job holds `pages: write` and `id-token: write`, and it never runs on `pull_request`. Deploys share a concurrency group that queues and never cancels.

## Consequences
- Anyone can open the preview. It shows synthetic data, labels itself a demo, sets `noindex`, and checkout stays disabled. No real orders, payments or delivery.
- No per-PR previews. A PR that changes the workflow, the Vite config or the smoke runs a build-only job.
- A move to a root domain or another host only changes `TAZUMO_WEB_BASE` and the workflow. Reverting is `gh api -X DELETE repos/wopee-io-demos/tazumo/pages`.
