#!/usr/bin/env bash
# Builds the real Tazumo web app, serves the production bundle with vite preview
# and captures deterministic README screenshots with Playwright Chromium.
set -euo pipefail
cd "$(dirname "$0")/.."
out="${SCREENSHOT_DIR:-docs/screenshots/web}"
export SCREENSHOT_DIR="$out"

pnpm build
rm -f "$out"/*.png
pnpm exec playwright test -c tests/screenshots/playwright.config.ts

if command -v pngquant >/dev/null; then
  for f in "$out"/*.png; do pngquant --quality 80-95 --speed 1 --strip --force --skip-if-larger --output "$f" "$f" || true; done
  optimiser="pngquant $(pngquant --version)"
else
  optimiser="none (pngquant not installed)"
fi

browser="$(node -e "const {chromium}=require('@playwright/test');chromium.launch().then(async b=>{console.log('Chromium '+b.version());await b.close()})")"
cat > "$out/provenance.json" <<JSON
{
  "sutCommit": "$(git rev-parse HEAD)",
  "sutCommitDirty": $([[ -z "$(git status --porcelain -- apps packages)" ]] && echo false || echo true),
  "fixtureData": "packages/core/src/index.ts products (synthetic, illustrative)",
  "captureCommand": "bash scripts/capture-web-screenshots.sh",
  "server": "vite preview of the production build (pnpm build)",
  "browser": "$browser",
  "playwright": "$(pnpm exec playwright --version)",
  "host": "$(uname -sm)",
  "viewports": {"desktop": "1440x900 @1x", "mobile": "390x844 @2x, touch"},
  "locale": "en-IE, app language EN, timezone Europe/Prague, light scheme, reduced motion, animations disabled",
  "clock": "fixed 2026-11-20T09:41:00+01:00",
  "optimiser": "$optimiser",
  "capturedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
ls -l "$out"
