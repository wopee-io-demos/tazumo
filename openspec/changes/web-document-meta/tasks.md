# Tasks

- [x] `pageTitle` / `useDocumentTitle` with localised `notFound` and `demoLabel` keys; brand name from `@tazumo/brand`.
- [x] Robots meta tag in `index.html` and `public/robots.txt`.
- [x] `tests/e2e/document-meta.spec.ts`, 6 tests: titles for every route type, language changes, detail-page titles that persist across reload, back/forward, robots.txt, and a production build checked for the meta tag and the absence of JSON-LD, microdata, rating, Open Graph and sitemap content (temp dir removed). Local Playwright 44/44 pass.
- [ ] Current-head CI green and review findings resolved (recorded in the PR before merge).
