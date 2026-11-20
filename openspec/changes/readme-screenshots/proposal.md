# Authentic SUT screenshots in the README

## Why
Tazumo is the reference system under test for four demo repositories. Readers and agents need to see what the real app looks like on web, iOS and Android without building it, and they need to know exactly which build each image came from. Mockups or unlabelled images would mislead consumers into treating them as test evidence.

## What changes
- `scripts/capture-web-screenshots.sh` builds the production web bundle, serves it with `vite preview` and runs `tests/screenshots/` with Playwright Chromium in a fixed EN locale, light scheme, reduced motion, fixed clock and disabled animations. It writes optimised PNGs and `provenance.json` to `docs/screenshots/web/`.
- A README gallery embeds those exact PNGs with a provenance table (SUT commit, fixture data, command, browser, viewport, date).
- A follow-up slice adds `.github/workflows/screenshots.yml` for iOS simulator and Android emulator captures on hosted runners and commits the CI-produced PNGs with the run URL.

## Out of scope
Store screenshots, marketing renders, Wopee or Appium execution evidence, deployed web captures.

## Tracking
Issue #37. No ADR: capture tooling reuses the existing Playwright dependency and introduces no contract or architectural trade-off.
