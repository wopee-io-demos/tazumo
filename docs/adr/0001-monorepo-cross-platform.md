# ADR-0001: Cross-platform TypeScript monorepo

Status: Accepted (native compilation under verification)
Date: 2026-11-20

## Context
Tazumo targets responsive web, iOS and Android with one shared domain layer and a small team. Expo SDK 53 does not reliably support pnpm's isolated dependency installation for native apps.

## Decision
Use pnpm workspaces with `nodeLinker: hoisted`, React/Vite for web, Expo/React Native for mobile, and pure TypeScript for shared domain logic. Do not force shared rendering components across DOM/native.

## Alternatives
Flutter shares a single rendering framework but increases migration cost from existing React. Separate apps duplicate domain logic. React Native Web could share UI but SEO needs are not yet established.

## Consequences
Hoisting improves SDK 53 native autolinking but weakens dependency isolation. Explicitly declare imports, validate app native builds in CI and reconsider isolated installs on an Expo SDK that supports them. Native compile currently tracked in issue #10. Runtime smoke tests still needed.
