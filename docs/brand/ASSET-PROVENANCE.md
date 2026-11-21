# Asset provenance

Every brand asset in the repository is listed here with its author, method and licence. Add a row before you commit a new asset. An asset whose rights cannot be verified is not committed.

Nothing in this file is a trademark or name clearance. The name "Tazumo" and the fox mark have **not** been searched or registered ([#6](https://github.com/wopee-io-demos/tazumo/issues/6)).

## Original artwork

| Asset | Author | Method | Licence |
| --- | --- | --- | --- |
| `assets/brand/fox-mark.svg` | SVG source written by an LLM coding agent (tazumo-A5) on 2026-11-20 for the repository owner | SVG code typed by hand: six polygons and two circles on a 120×120 grid. Not traced, not derived from any existing mascot, logo or clip art, and not produced by an image-generation model. | See the rights note below |
| `assets/brand/fox-mascot.svg` | Same as above | SVG code typed by hand: the fox-mark head on a trapezoid body with a polygon tail and rounded-rectangle paws on a 240×280 grid. | See the rights note below |
| `assets/brand/fox-mark-512.png`, `assets/brand/fox-mascot-512.png` | Generated | Rendered from the SVGs above by `packages/brand/scripts/export-icons.ts` (Playwright Chromium). | Derived from the SVGs, same licence |
| `assets/brand/app-icon/icon-1024.{svg,png}` | Generated | Fox mark with a cream outline on the palette `primary` (default violet `#6928E8`), 1024×1024, opaque RGB for the iOS App Store. | Derived, same licence |
| `assets/brand/app-icon/android-adaptive-foreground.{svg,png}` | Generated | Outlined fox mark inside the 66dp-of-108dp safe circle (farthest pixel 295px of the 313px safe radius), transparent background, 1024×1024. | Derived, same licence |
| `assets/brand/app-icon/android-adaptive-background.{svg,png}` | Generated | Solid palette `primary`, 1024×1024. | Derived, same licence |
| `assets/brand/app-icon/android-adaptive-monochrome.{svg,png}` | Generated | White fox silhouette with eye, ear and muzzle cut-outs for Android 13 themed icons, 1024×1024. | Derived, same licence |

**Rights note.** The repository has no `LICENSE` file at the time of writing. The SVG code was written by an AI agent under the repository owner's direction. Whether copyright subsists in AI-authored work, and who holds it, varies by jurisdiction and has not been assessed. Treat these files as project-internal demo artwork until the owner adds a licence and, if the mark is to be used commercially, has a human designer review or redraw it as part of the clearance work in #6. "Same licence" in the rows below means whatever applies to the source SVGs.

Regenerate the derived files with:

```sh
node --experimental-strip-types packages/brand/scripts/export-icons.ts [violet|coral|emerald|midnight]
```

## Fonts (loaded from Google Fonts, not bundled)

| Font | Source | Licence |
| --- | --- | --- |
| Plus Jakarta Sans | https://fonts.google.com/specimen/Plus+Jakarta+Sans | SIL Open Font License 1.1 |
| DM Sans | https://fonts.google.com/specimen/DM+Sans | SIL Open Font License 1.1 |

`apps/web/src/style.css` loads both families at runtime from `fonts.googleapis.com`. That sends each visitor's IP address to Google, which is a known GDPR concern in the EU, so self-hosting is tracked in [#47](https://github.com/wopee-io-demos/tazumo/issues/47). The mobile app uses the system font. Before bundling the font files, add the OFL text next to them.

## Photography

No photographs are committed. Catalogue products still use emoji placeholders. The sourcing plan is tracked in [#48](https://github.com/wopee-io-demos/tazumo/issues/48). Each photo must record its source page URL, author, licence name and licence URL here before it is committed.
