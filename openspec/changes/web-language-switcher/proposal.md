# Change: Header language switcher on every web route

Issue: [#3](https://github.com/wopee-io-demos/tazumo/issues/3) (consumer web MVP slice). Builds on `european-localization` (#11) and `web-discovery`.

## Why
The language control lived in the home catalogue section, so merchant and product pages could not change language. The choice was also lost on reload.

## What changes
- `apps/web/src/i18n/`: a `LanguageSwitcher` in the header (all routes) and a `useLanguage` hook that persists the choice in `localStorage` (`tazumo.language`), validates it, falls back to English and sets `document.documentElement.lang`.
- The select keeps `id="language"`, its visible label and `data-testid="sut-language"` (the #33 contract name). Options use native names with a `lang` attribute.
- `@tazumo/core` (additive): `languageNames`.
- Playwright spec `tests/e2e/web-i18n.spec.ts`.

## Out of scope
Browser-locale auto-detection (the SUT contract expects an English default), translated merchant inventory, URL-based locale.
