# Rate limits on public API routes

## Why
Issue #98. CodeQL `js/missing-rate-limiting` reported that the anonymous catalogue and health routes query PostgreSQL without any limit. Only `BearerAuth` routes were limited (#66). PR #77 excluded the query from the CodeQL gate until this was fixed.

## What changes
- Every route now declares a rate-limit tier in its Fastify route config (`config.rateLimit`):
  - `public`: per client IP, 300 requests per 60 s;
  - `health`: per client IP, 1,200 requests per 60 s, so deploy probes are not starved by discovery traffic;
  - `authenticated`: the existing IP layer and principal layer.
- The `onRoute` hook attaches the matching limiter. Startup fails if a route declares no tier, or if its tier contradicts the contract's `BearerAuth` requirement. Future anonymous routes therefore cannot be unlimited.
- The `js/missing-rate-limiting` exclusion is removed from `.github/codeql/codeql-config.yml`. CodeQL's Fastify model recognises per-route `config.rateLimit`, and the limiter enforces it.
- Contract `0.6.0-draft`: 429 with `Retry-After` on the public discovery operations.

## Out of scope
Distributed limits across instances.

## Tracking
Issue #98; builds on #66 and #77.
