# Design

- **Placement:** the switcher follows the cart button inside `.headerActions`, so tab order matches visual order. At 600 px and below, the actions wrap below the logo and the word "Language" is visually hidden. The globe icon and the accessible name remain.
- **Accessible name:** a `<label for="language">` with the localized word, so the name follows the UI language ("Language", "Jazyk", "Sprache"). Options carry native names and `lang`, so the target language is recognizable from any UI language.
- **Persistence:** `localStorage` behind try/catch, validated against `languages`. There is no browser-locale detection, because demos and the SUT contract need a deterministic English default for fresh contexts.
- **Colours:** token variables only (`--ink`, `--tint`), with the global ink focus ring.
