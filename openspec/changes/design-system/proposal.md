# Change: Design-system foundation, original fox artwork and brand guidelines

Issue: [#13](https://github.com/wopee-io-demos/tazumo/issues/13) (related [#6](https://github.com/wopee-io-demos/tazumo/issues/6)) · ADR: [0011](../../../docs/adr/0011-design-system-tokens.md)

## Why
Brand tokens were four flat palettes with no dark mode, no scales and no contrast evidence. The mascot was an emoji. Issue #13 asks for accessible tokens, an original fox, asset provenance and writing guidelines.

## What changes
- `@tazumo/brand` adds semantic light and dark themes for every palette, plus spacing, radius, typography, elevation, touch-target and z-index scales, a CSS-variable helper and an independent `BrandConfig` (name, palette, mascot).
- A WCAG 2.2 contrast test in `pnpm test` checks every approved foreground/background pairing.
- Hand-written SVG fox mark and mascot, with generated iOS and Android app-icon PNGs in `assets/brand/`.
- `docs/brand/ASSET-PROVENANCE.md` and `docs/brand/GUIDELINES.md`.

## Out of scope
- Wiring tokens and icons into apps ([#47](https://github.com/wopee-io-demos/tazumo/issues/47)).
- Catalogue photography ([#48](https://github.com/wopee-io-demos/tazumo/issues/48)). No licence was verified in this slice, so no photos ship.
- Name, trademark and domain clearance ([#6](https://github.com/wopee-io-demos/tazumo/issues/6)). Nothing here claims clearance.
