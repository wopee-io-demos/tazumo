# Tasks

- [x] Reproduced on main 1717a56: `expo export --dev --platform ios` exits 1 with `chevron-left.png: getImageSize is not a function`.
- [x] Adapter and scoped override. Metro resolves `image-size@2.1.0-v1-api.0` (the adapter), which uses `image-size-v2@2.1.0`. The adapter's tests pass 3/3: 1.x call shapes, the patched 2.x line, and invalid input still throwing.
- [x] `expo export --dev` for iOS and Android succeeds locally. `pnpm bundle:mobile` produces 4 exports. `pnpm typecheck && pnpm test && pnpm build` pass.
- [x] `pnpm audit --audit-level high` exits 0 (5 moderate findings, none in image-size).
- [x] ADR-0001 dependency note.
- [ ] Current-head CI green; merge SHA recorded on #136.
