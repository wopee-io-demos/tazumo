# ADR-0001: Cross-platform TypeScript monorepo

Status: Accepted (provisional pending build verification)
Date: 2026-11-20

## Context
Tazumo must deliver responsive web, iOS and Android with a small team and reusable business logic.

## Decision
Use pnpm workspaces. React/Vite for web, Expo/React Native for mobile, pure TypeScript for shared domain logic. Do not force shared presentation components across DOM and native runtimes yet.

## Alternatives
Flutter would allow one UI toolkit but complicate incremental migration of the existing React prototype. Three separate apps maximize native UI control but increase duplicated product logic. React Native Web could share UI, but migration and SEO requirements are not yet established.

## Consequences
Domain logic and brand decisions remain shared; UI can be optimized for device. Native builds still require distinct toolchains and manual verification. Reassess when measured duplication becomes significant.
