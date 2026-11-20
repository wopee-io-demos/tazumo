# GitHub Packages test distribution

## Why
Cross-repository QA and manual testing need reproducible, permissioned test artifacts without publishing customer-facing software prematurely.

## Scope
- Versioned organization-scoped synthetic fixture npm package.
- GHCR web test-preview image, source-linked by OCI metadata.
- Push-to-main and manual publish workflow with build gates and restricted token permissions.
- Consumption instructions, version provenance and package visibility review.

## Tracking
Issue #29; ADR-0006.

## Acceptance criteria
- [x] Define package source and workflow.
- [x] Document package format, access and constraints.
- [ ] CI verifies both package build and container build.
- [ ] Merge after review.
- [ ] Publish both package types with workflow on main.
- [ ] Verify org Packages listings, visibility, repository read access and pull/install from an independent test repo.
- [ ] Record artifact links and test results in #29.

- [x] Include upstream canonical SUT v0.1.0 identifiers and capability boundaries in the organization test kit.
- [ ] Verify npm consumer imports SUT contract JSON after package publication.
