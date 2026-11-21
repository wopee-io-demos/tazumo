# Proposal: Metro debug bundles work with the patched image-size

Tracking issue: [#136](https://github.com/wopee-io-demos/tazumo/issues/136). The dependency note is in ADR-0001.

## Why
The root override `image-size: ^2.0.3` fixes three high-severity advisories, and no patched 1.x exists. Metro 0.82 (Expo SDK 53) calls the 1.x API, so every debug bundle failed with `getImageSize is not a function`. That broke `expo start` and debug builds. Production exports were unaffected.

## What changes
- `apps/mobile/tooling/image-size-v1-compat` is a private package named `image-size`. It keeps the 1.x call signature (buffer or path, optional callback) and delegates to `image-size@^2.0.3`, installed under the alias `image-size-v2`.
- Root override `metro>image-size: file:./apps/mobile/tooling/image-size-v1-compat`. The global `image-size: ^2.0.3` override stays.
- `apps/mobile` gets a `bundle:dev` script (`expo export --dev` for iOS and Android). The root `bundle:mobile`, which the required `check` job runs, calls it as a regression guard.
- The adapter's unit tests are part of `pnpm --filter @tazumo/mobile test`.

## Scope
No change to workflows, app code or other dependencies. Remove the adapter when the Expo SDK upgrade (#100) brings a Metro on image-size 2.x.
