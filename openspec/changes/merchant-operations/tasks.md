# Tasks

## Slice 1 (domain package)

- [x] ADR-0019: pure domain package versus `packages/core` or `apps/api`; `Intl` versus a timezone library; haversine versus PostGIS; system actor for auto-declines.
- [x] Onboarding state machine with role checks and audit entries. Evidence: `packages/merchant-ops/src/onboarding.test.ts` (happy path with six audited transitions, rejection and revision, seven illegal transitions, thirteen forbidden actor cases, reason and profile refusals, next-command table). Mutation check: removing the role check fails the forbidden test.
- [x] Store profile validation aligned with migration 0001. Evidence: profile tests in `onboarding.test.ts`.
- [x] Role names match `apps/api/src/auth/policy.ts` and migration 0002. Evidence: drift test in `onboarding.test.ts`.
- [x] Opening hours with timezone, overnight intervals and exceptions. Evidence: `hours.test.ts`, DST spring-forward and fall-back for Europe/Bratislava and Europe/Berlin. Mutation check: evaluating in a fixed UTC+1 offset fails six tests.
- [x] Delivery zones (haversine, inclusive radius), inventory availability and `checkOrderable`. Evidence: `operations.test.ts`.
- [x] Order acceptance window with accept, decline and system auto-decline. Evidence: `operations.test.ts`.
- [x] Proposed migration and route plan in `design.md`.
- [ ] Follow-up issue "Wire merchant-ops into apps/api" filed as `status:backlog`.
- [ ] Current-head CI green on the PR.
- [ ] Review findings resolved and merge SHA recorded on #12.

Local evidence (Node 22.19.0, macOS): `pnpm --filter @tazumo/merchant-ops test` 26/26 pass; `pnpm typecheck`, `pnpm test`, `pnpm build` and `openspec validate --all --strict` results are recorded in the PR.

Not implemented: HTTP routes, migrations, contract changes, UI, courier logic, ETAs.
