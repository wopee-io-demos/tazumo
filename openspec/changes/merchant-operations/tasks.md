# Tasks

## Slice 1 (domain package)

- [x] ADR-0019: pure domain package versus `packages/core` or `apps/api`; `Intl` versus a timezone library; haversine versus PostGIS; system actor for auto-declines.
- [x] Onboarding state machine with role checks and audit entries. Evidence: `packages/merchant-ops/src/onboarding.test.ts` (happy path with six audited transitions, rejection and revision, seven illegal transitions, fourteen forbidden principal cases, a multi-grant principal, reason length and type, profile refusals, next-command table). Mutation check: removing the role check fails the forbidden test.
- [x] Store profile validation aligned with migration 0001. Evidence: profile tests in `onboarding.test.ts`.
- [x] Role names match `apps/api/src/auth/policy.ts` and migration 0002. Evidence: drift test in `onboarding.test.ts`.
- [x] Opening hours with timezone, overnight intervals and exceptions. Evidence: `hours.test.ts`, DST spring-forward and fall-back for Europe/Bratislava, Europe/Berlin and America/New_York; malformed hours fail closed. Mutation check: evaluating in a fixed UTC+1 offset fails six tests.
- [x] Delivery zones (haversine, inclusive radius), inventory availability and `checkOrderable`. Evidence: `operations.test.ts`.
- [x] Order acceptance window with accept, decline and system auto-decline. Evidence: `operations.test.ts`.
- [x] Proposed migration and route plan in `design.md`.
- [x] Follow-up issue filed as `status:backlog`: #75 "Wire merchant-ops into apps/api (migration, routes, policy)".
- [x] Independent review on be7401e: no blockers, eight should-fix items, all fixed: malformed hours fail closed; unknown decisions refused; string instants need an offset; actor is the API `Principal` with grants; `merchant_paused` for `accepting_orders`; design adds the `available` grant, a seed backfill, the profile source of truth and 404 for non-live delivery checks; corrupt deadlines count as expired; malformed input returns codes instead of throwing. Nits fixed: raw-length profile checks, `reason_too_long`, decline-reason CHECKs, integer radius, a non-EU DST zone, an independent radius boundary.
- [ ] Current-head CI green on the PR.
- [ ] Review findings resolved and merge SHA recorded on #12.

Local evidence (Node 22.19.0, macOS): `pnpm --filter @tazumo/merchant-ops test` 30/30 pass; `pnpm typecheck`, `pnpm test`, `pnpm build` and `openspec validate --all --strict` results are recorded in the PR.

Not implemented: HTTP routes, migrations, contract changes, UI, courier logic, ETAs.
