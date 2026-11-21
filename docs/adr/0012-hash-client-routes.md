# ADR-0012: Hash-based client routes for the web prototype

Status: Accepted for prototype
Date: 2026-11-20

## Context
Issue #3 adds merchant and product detail pages to the Vite SPA (ADR-0004). The pages need deep links, browser back/forward and stable URLs that test tools can open directly. The repository has no lockfile yet (#14), and the web build artifact may be served from static hosting without SPA rewrites.

## Options
1. **Hash routes with a small `hashchange` hook (chosen).** `#/merchant/<id>` and `#/product/<id>`. No dependency, works with `vite dev`, `vite preview` and any static host, and keeps in-memory cart state across navigation.
2. **History API paths with a hand-written router.** Cleaner URLs, but every host needs an index.html fallback, and a direct load of `/merchant/x` breaks on plain static hosting.
3. **React Router.** Mature nested routing and data loading, but it adds a dependency without a lockfile and is more than three routes need.

## Decision
Use option 1 in `apps/web/src/discovery/route.ts`. Route parsing is a pure function, so it can be tested or replaced.

## Consequences
URLs contain `#`. They are not crawlable as separate pages, which matches ADR-0004's position that SEO rendering is decided before public launch. A move to path routes or a framework router only touches `route.ts` and the link builders.
