#!/usr/bin/env bash
# Builds the real Tazumo web app, serves the production bundle with vite preview
# and captures deterministic README screenshots with Playwright Chromium.
# Needs: pnpm install, pnpm exec playwright install chromium, pngquant, network access (Google Fonts).
set -euo pipefail
cd "$(dirname "$0")/.."
out="${SCREENSHOT_OUT:-docs/screenshots/web}"
max_bytes="${SCREENSHOT_MAX_BYTES:-307200}"
command -v pngquant >/dev/null || { echo "pngquant is required (brew install pngquant / apt-get install pngquant)" >&2; exit 1; }

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
export SCREENSHOT_DIR="$staging"
export SCREENSHOT_CLOCK="${SCREENSHOT_CLOCK:-2026-11-20T09:41:00+01:00}"

pnpm build
pnpm exec playwright test -c tests/screenshots/playwright.config.ts

for f in "$staging"/*.png; do
  pngquant --quality 80-95 --speed 1 --strip --force --skip-if-larger --output "$f" "$f" || { rc=$?; [[ $rc == 98 || $rc == 99 ]]; }
  size="$(wc -c < "$f")"
  (( size <= max_bytes )) || { echo "$(basename "$f") is $size bytes, above $max_bytes" >&2; exit 1; }
done

node - "$staging/provenance.json" "$(pngquant --version)" <<'JS'
const {execSync}=require('node:child_process');
const {writeFileSync}=require('node:fs');
const {chromium}=require('@playwright/test');
const sh=c=>execSync(c,{encoding:'utf8'}).trim();
const sutPaths='apps/web packages package.json pnpm-workspace.yaml';
(async()=>{
  const browser=await chromium.launch();
  const provenance={
    sutCommit:sh(`git log -1 --format=%H -- ${sutPaths}`),
    captureCommit:sh('git rev-parse HEAD'),
    worktreeDirty:sh(`git status --porcelain -- ${sutPaths} tests/screenshots scripts/capture-web-screenshots.sh`)!=='',
    fixtureData:'packages/core/src/index.ts products (synthetic, illustrative)',
    captureCommand:'bash scripts/capture-web-screenshots.sh',
    server:'vite preview of the production build (pnpm build)',
    browser:`Chromium ${browser.version()}`,
    playwright:sh('pnpm exec playwright --version'),
    host:sh('uname -sm'),
    viewports:{desktop:'1440x900 @1x',mobile:'390x844 @2x, touch'},
    environment:'app language EN, locale en-IE, timezone Europe/Prague, light scheme, reduced motion, animations and caret disabled, Google Fonts loaded from the network',
    clock:process.env.SCREENSHOT_CLOCK,
    optimiser:`pngquant ${process.argv[3]}`,
    capturedAt:new Date().toISOString().replace(/\.\d+Z$/,'Z')
  };
  await browser.close();
  writeFileSync(process.argv[2],JSON.stringify(provenance,null,2)+'\n');
})();
JS

mkdir -p "$out"
rm -f "$out"/*.png "$out"/provenance.json
cp "$staging"/*.png "$staging"/provenance.json "$out"/
ls -l "$out"
