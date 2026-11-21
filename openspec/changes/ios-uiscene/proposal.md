# Proposal: Adopt the UIScene life cycle for iOS 27

Tracking issue: [#171](https://github.com/wopee-io-demos/tazumo/issues/171).

## Why
Built with Xcode 27 (iOS 27 SDK), the app crashed about 3 seconds after launch on iOS 27 simulators. The crash is `EXC_BREAKPOINT` in UIKit `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, because Expo SDK 53's prebuild has no UIScene configuration.

## What changes
- `apps/mobile/plugins/with-ui-scene.js`: a scene manifest, plus a `SceneDelegate` that starts React Native in the window scene. It fails prebuild on an unknown `AppDelegate` template.
- An iOS launch smoke in `native-builds.yml` on the newest 27.x and 26.x simulators. It fails when the app isn't running or a crash report appears.

## Scope
No Expo SDK upgrade (#100) and no ADR: this is a config plugin on the current SDK.
