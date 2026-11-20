# Tasks

- [x] Add semantic light/dark themes for violet, coral, emerald and midnight (`packages/brand/src/themes.ts`).
- [x] Add spacing, radius, typography, elevation, touch-target and z-index scales (`packages/brand/src/scales.ts`).
- [x] Add WCAG 2.2 contrast utilities and a test over every pairing × palette × mode: 4 palettes × 2 modes × 23 pairings = 184 checks pass locally (`pnpm test`, 14 brand tests pass). Mutation check: setting emerald light `textMuted` to `#8FA39D` failed the test with 3 named pairings.
- [x] Keep legacy exports and pin them in a test, and check the legacy palette pairings that the apps use today.
- [x] Add `BrandConfig`/`createBrand` with tests showing that name, palette and mascot vary independently.
- [x] Hand-write `assets/brand/fox-mark.svg` and `fox-mascot.svg`, then export the 1024 iOS icon (RGB, no alpha) and Android adaptive foreground, background and monochrome PNGs. Checked by eye, including a circle and squircle mask preview and a monochrome-on-dark preview.
- [x] Write `docs/brand/ASSET-PROVENANCE.md` and `docs/brand/GUIDELINES.md` (EN, CS, DE).
- [x] File follow-ups: app wiring [#47](https://github.com/wopee-io-demos/tazumo/issues/47), photography [#48](https://github.com/wopee-io-demos/tazumo/issues/48).
- [ ] Current-head CI green on PR #44.
- [ ] Independent review findings resolved and recorded in PR #44.
- [ ] Merge PR #44 and record the merge SHA in #13.
- [ ] Native-speaker review of the CS and DE guidance (#11).
