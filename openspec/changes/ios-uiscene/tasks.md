# Tasks

- [x] Crash diagnosed from `Tazumo-2026-11-21-141014.ips` (main screenshots run 44895831681, mac-ios-1, iOS 27.0).
- [x] `with-ui-scene` config plugin. Prebuild output checked locally (template generation only): the AppDelegate patch and the Info.plist scene manifest. Unit tests pass 3/3.
- [x] iOS launch smoke script and workflow steps. `actionlint` and the runner guard pass.
- [ ] CI on mac-ios-1: the build compiles and the app stays up on iOS 27.x and 26.x.
- [ ] Interim #172 (screenshots pinned to 26.x) reverted after this lands.
