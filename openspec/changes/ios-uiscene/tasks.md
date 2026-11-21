# Tasks

- [x] Crash diagnosed from `Tazumo-2026-11-21-141014.ips` (main screenshots run 44895831681, mac-ios-1, iOS 27.0).
- [x] `with-ui-scene` config plugin. Prebuild output checked locally (template generation only): the AppDelegate patch and the Info.plist scene manifest. Unit tests pass 3/3.
- [x] iOS launch smoke script and workflow steps. `actionlint` and the runner guard pass.
- [x] CI on mac-ios-1 at 6bdf40e ([run 44908726118](https://github.com/wopee-io-demos/tazumo/actions/runs/44908726118)): `BUILD SUCCEEDED` with SDK iphonesimulator27.2. The launch smoke kept the app running after 20 s on iOS 27.0 (pid 52913) and iOS 26.5 (pid 56672), with no crash report. The screenshot shows React Native's Debug red box drawn in the scene window ("No script URL provided", expected without an embedded bundle).
- [x] Interim #172 (aec2e68, screenshots on a runtime below 27) reverted here: the `TEMP(#171)` block is removed and newest-runtime selection restored. It keeps the fail-closed error when no iOS runtime exists, and the runtime log line.
- [ ] Current-head CI green after the merge with main.
