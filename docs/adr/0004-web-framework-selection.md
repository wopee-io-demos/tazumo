# ADR-0004: Vite SPA for initial consumer prototype; revisit SSR before public launch

Status: Accepted for prototype (re-evaluate before production)
Date: 2026-11-20

## Context

Two alternative monorepo PRs were created: #1 with Next.js and Expo, #8 with Vite/React and Expo. Merging both would generate incompatible app packages and build configurations. PR #8 currently demonstrates a tested consumer UI and native development artifacts; PR #16 adds localization on top.

## Decision

Use the Vite/React + Expo architecture from PR #8 for the **initial prototype**, retaining typed shared core/brand contracts, OpenSpec and CI. Close #1 as superseded after auditing its unique requirements under issue #26. Do not pretend this settles the public site's SEO architecture.

## Trade-offs

- Vite SPA: simpler deployment and build, fast iteration, tested existing foundation.
- Next.js/SSR: server-rendered discoverability for city, merchant and category landing pages, structured metadata, caching and performance. These may become important for a production consumer marketplace.
- Expo native: consistent TS domain logic with separate native UX.

## Revisit triggers

Before public SEO-focused launch, measure search and product requirements and decide whether the marketing/discovery pages need Next.js SSR/SSG or another rendering strategy. Record decision in a new ADR. Track migration parity in #26.

## Consequences

Close superseded PR #1 and do not merge its competing foundation. Keep source branch until branch-deletion tooling/permissions can safely remove it; retain this ADR and issue history as rationale.
