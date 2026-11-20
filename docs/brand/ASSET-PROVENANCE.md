# Asset provenance

Every brand asset in the repository is listed here with its author, method and licence. Add a row before you commit a new asset. An asset whose rights cannot be verified is not committed.

Nothing in this file is a trademark or name clearance. The name "Tazumo" and the fox mark have **not** been searched or registered ([#6](https://github.com/wopee-io-demos/tazumo/issues/6)).

## Original artwork

| Asset | Author | Method | Licence |
| --- | --- | --- | --- |
| `assets/brand/fox-mark.svg` | Wopee demo agent tazumo-A5, for the tazumo repository, 2026-11-20 | Hand-written SVG built from seven basic polygons and two circles on a 120×120 grid. Not traced and not derived from any existing mascot, logo, clip art or AI image generator. | Same licence as this repository |
| `assets/brand/fox-mascot.svg` | Same as above | Hand-written SVG: the fox-mark head on a trapezoid body with a polygon tail and rounded-rectangle paws on a 240×280 grid. | Same licence as this repository |
| `assets/brand/fox-mark-512.png`, `assets/brand/fox-mascot-512.png` | Generated | Rendered from the SVGs above by `packages/brand/scripts/export-icons.ts` (Playwright Chromium). | Derived from the SVGs, same licence |
| `assets/brand/app-icon/icon-1024.{svg,png}` | Generated | Fox mark on the palette `primary` (default violet `#6928E8`), 1024×1024, opaque RGB for the iOS App Store. | Derived, same licence |
| `assets/brand/app-icon/android-adaptive-foreground.{svg,png}` | Generated | Fox mark inside the 66dp-of-108dp safe circle, transparent background, 1024×1024. | Derived, same licence |
| `assets/brand/app-icon/android-adaptive-background.{svg,png}` | Generated | Solid palette `primary`, 1024×1024. | Derived, same licence |
| `assets/brand/app-icon/android-adaptive-monochrome.{svg,png}` | Generated | White fox silhouette with eye, ear and muzzle cut-outs for Android 13 themed icons, 1024×1024. | Derived, same licence |

The repository has no `LICENSE` file at the time of writing, so "same licence as this repository" means all rights are reserved by the repository owner until a licence is added.

Regenerate the derived files with:

```sh
node --experimental-strip-types packages/brand/scripts/export-icons.ts [violet|coral|emerald|midnight]
```

## Fonts (referenced, not bundled)

| Font | Source | Licence |
| --- | --- | --- |
| Plus Jakarta Sans | Google Fonts | SIL Open Font License 1.1 |
| DM Sans | Google Fonts | SIL Open Font License 1.1 |

The apps name these families in CSS but neither load nor bundle them, so users see the system fallback unless the font is installed locally. Before loading or bundling a font, record its source URL and the OFL text here.

## Photography

No photographs are committed. Catalogue products still use emoji placeholders. The sourcing plan is tracked in [#48](https://github.com/wopee-io-demos/tazumo/issues/48). Each photo must record its source page URL, author, licence name and licence URL here before it is committed.
