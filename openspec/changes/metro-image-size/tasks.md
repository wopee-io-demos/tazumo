# Tasks

- [x] Reproduced on main 1717a56: `expo export --dev --platform ios` exits 1 with `chevron-left.png: getImageSize is not a function`.
- [x] Adapter and scoped override. Metro resolves `image-size@2.1.0-v1-api.0` (the adapter), which uses `image-size-v2@2.1.0`. The adapter's tests pass 3/3: 1.x call shapes, the patched 2.x line, and invalid input still throwing.
- [x] `expo export --dev` for iOS and Android succeeds locally. `pnpm bundle:mobile` produces 4 exports. `pnpm typecheck && pnpm test && pnpm build` pass.
- [x] `pnpm audit --audit-level high` exits 0 (5 moderate findings, none in image-size).
- [x] ADR-0001 dependency note.
- [x] Independent review (subagent) at 2fce687 found no blockers. Fixed:
  - the adapter was renamed to `@tazumo/image-size-v1-compat` 0.0.0, so no made-up `image-size` version appears in `node_modules`;
  - the adapter tests moved into the root `pnpm test` (required `check` job);
  - invalid input now throws a TypeError and path errors name the file;
  - the spec and ADR wording now say Metro uses the adapter.
- [ ] Current-head CI green; merge SHA recorded on #136.
