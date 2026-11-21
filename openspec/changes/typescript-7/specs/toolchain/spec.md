## ADDED Requirements

### Requirement: Single TypeScript compiler major
All workspaces SHALL type-check with the same TypeScript major, declared in each `package.json` and locked in `pnpm-lock.yaml`. Tools that need a JavaScript compiler API SHALL use a pinned compatibility package instead of a second `typescript` version.

#### Scenario: Workspace typecheck
- **WHEN** `pnpm typecheck` runs
- **THEN** every workspace is checked by TypeScript 7 and passes

#### Scenario: SUT contract check parses TSX
- **WHEN** `pnpm check:sut` or the contract tests run
- **THEN** `scripts/sut-contract.mjs` parses the app sources through `@typescript/typescript6` and reports the same selectors as before the upgrade

#### Scenario: Mobile bundle on TypeScript 7
- **WHEN** `pnpm bundle:mobile` or an Android release build bundles the Expo app
- **THEN** Metro bundles without calling the TypeScript compiler API, because `experiments.tsconfigPaths` is off
