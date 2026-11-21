# Change: Per-route document titles and no-index policy

Issue: [#97](https://github.com/wopee-io-demos/tazumo/issues/97)

## Why
All routes shared one static title (WCAG 2.2 SC 2.4.2 Page Titled). Nothing told crawlers that the synthetic merchants are not real businesses.

## What changes
- `apps/web/src/discovery/documentTitle.ts`: `pageTitle(route, lang)` and `useDocumentTitle`. Format `<page> · <brandName> (<demo>)`, where `brandName` comes from `@tazumo/brand` and the page and demo words come from `@tazumo/core` messages (new `notFound` and `demoLabel` keys).
- `apps/web/index.html`: `<meta name="robots" content="noindex, nofollow">`. `apps/web/public/robots.txt`: `Disallow: /`.
- `tests/e2e/document-meta.spec.ts`.

## Out of scope
SSR/SSG and public SEO (ADR-0004), Open Graph previews, JSON-LD, sitemap, native apps.
