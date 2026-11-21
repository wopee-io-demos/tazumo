# Design: design-system foundation

Decision record: [ADR-0011](../../../docs/adr/0011-design-system-tokens.md).

## Token layers
1. **Legacy palettes** (`palettes`): four flat swatches that the apps read today. They are frozen and pinned by a test.
2. **Semantic themes** (`themes[palette][mode]`): 13 roles. Light themes reuse the legacy colours, and dark themes are hand-picked.
3. **Pairings** (`contrastPairings`): the only approved foreground/background combinations, each tagged `text`, `largeText` or `ui`. The contrast test iterates pairings × palettes × modes.
4. **Scales**: plain numbers (CSS px on web, points in React Native). Elevation carries both a CSS `box-shadow` and React Native shadow props.

## Brand selection
`createBrand({ name, palette, mascot })` resolves the three independent settings. The fox has its own colours (`foxColors`), so palette changes never recolour it. The app icon combines the fox mark, a cream outline and the palette `primary`.

## Asset pipeline
`assets/brand/fox-mark.svg` is the single source for the mark. `packages/brand/scripts/export-icons.ts` reads it, derives the outline and the monochrome silhouette from its polygons, and renders PNGs with the Playwright Chromium that e2e already installs. The exported files are committed, so builds never run the script.

## Wiring (follow-up #47)
Web: `toCssVariables(getTheme(palette, mode))`, plus `focus` for `:focus-visible`. Mobile: `themes[palette][useColorScheme()]` and `elevation[n].native`. Expo: `icon` and `android.adaptiveIcon.*` point at `assets/brand/app-icon/`.
