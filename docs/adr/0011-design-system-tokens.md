# ADR-0011: Semantic design tokens with tested contrast, alongside legacy palettes

Status: Accepted
Date: 2026-11-20
Issue: [#13](https://github.com/wopee-io-demos/tazumo/issues/13) (related [#6](https://github.com/wopee-io-demos/tazumo/issues/6))

## Context
`@tazumo/brand` exported four flat palettes (`primary`, `accent`, `background`, `ink`) that apps/web and apps/mobile read directly. The e2e suite asserts exact values (for example emerald `--primary` = `#087F62`). There was no dark mode, no spacing, type or elevation scale, and no proof of contrast. `accent` is used as the web focus ring, and on three of four palettes it is below 3:1 against white. ADR-0002 requires name, palette and mascot to stay independent.

## Decision
1. Keep `brandName`, `palettes`, `PaletteName`, `preferredPalette` and `mascot` unchanged in name and value. A unit test pins them.
2. Add semantic themes: `themes[palette][light|dark]` with 13 roles (`background`, `surface`, `tint`, `text`, `textMuted`, `primary`, `onPrimary`, `accent`, `onAccent`, `focus`, `border`, `danger`, `success`). Light themes reuse the legacy colours, so wiring them in changes no existing brand colour.
3. Declare approved foreground/background combinations once in `contrastPairings`. A unit test computes the WCAG 2.2 contrast ratio for every pairing in every palette and mode (4.5:1 text, 3:1 large text and UI) and fails if any colour role has no pairing.
4. Add platform-neutral numeric scales (`spacing`, `radius`, `typography`, `elevation` with CSS and React Native shapes, `touchTarget`, `zIndex`) and a `toCssVariables` helper.
5. Model brand selection as `BrandConfig { name, palette, mascot }` resolved by `createBrand`. `mascot` may be `none`. The fox keeps its own colours, and the app-icon background is generated from the selected palette's `primary`.
6. App icons are generated from hand-written SVG by a script that uses the repository's existing Playwright Chromium, so no new image dependency is added.

## Alternatives considered
- **Rename or reshape `palettes` into themes.** Rejected: it would break both apps and the e2e contract while other agents are editing them.
- **Style Dictionary or a JSON token pipeline.** Rejected for now: it adds a build step and dependency for four palettes. The TypeScript objects can be exported to JSON later.
- **Generate dark variants algorithmically.** Rejected: hand-picked values passed the contrast test with margin, and generated ones were harder to reason about per palette.
- **Check contrast with an external audit tool only.** Rejected: one-off audits rot. The unit test runs in `pnpm test` on every PR.
- **sharp or resvg for PNG export.** Rejected: new native dependency. Playwright Chromium is already required for e2e.

## Consequences
- Apps must move from `palettes` to `themes` and use `focus` for focus rings. That work is tracked in [#47](https://github.com/wopee-io-demos/tazumo/issues/47) because other active work owns the app files.
- A new colour role must come with pairings or the test fails. A new palette must ship light and dark themes.
- The fox mark and name remain uncleared. ADR-0002's launch blocker on trademark-safe identity still applies.
