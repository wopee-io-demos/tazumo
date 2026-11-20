import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { palettes, preferredPalette, type PaletteName } from '../src/palettes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const brandDir = resolve(root, 'assets/brand');
const outDir = resolve(brandDir, 'app-icon');
const palette = (process.argv[2] ?? preferredPalette) as PaletteName;
if (!(palette in palettes)) throw new Error(`Unknown palette ${palette}. Use one of ${Object.keys(palettes).join(', ')}`);
const background = palettes[palette].primary;

const inner = (file: string) => readFileSync(resolve(brandDir, file), 'utf8').replace(/^[\s\S]*?<\/title>/, '').replace(/<\/svg>\s*$/, '');
const mark = inner('fox-mark.svg');
const markCentre = { x: 60, y: 59 };
const placed = (content: string, scale: number) =>
  `<g transform="translate(512 512) scale(${scale}) translate(${-markCentre.x} ${-markCentre.y})">${content}</g>`;
const svg = (body: string, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>\n`;

const silhouette = `<defs><mask id="cut"><polygon points="22,14 46,40 74,40 98,14 104,62 60,104 16,62" fill="#fff"/><polygon points="25,24 40,40 21,49" fill="#000"/><polygon points="95,24 80,40 99,49" fill="#000"/><circle cx="42" cy="52" r="4.5" fill="#000"/><circle cx="78" cy="52" r="4.5" fill="#000"/><polyline points="16,62 44,60 60,78 76,60 104,62" fill="none" stroke="#000" stroke-width="3"/><polygon points="53,91 67,91 60,100" fill="#000" stroke="#000" stroke-width="2" stroke-linejoin="round"/></mask></defs><rect width="120" height="120" fill="#FFFFFF" mask="url(#cut)"/>`;

// Android adaptive icons: 108dp canvas, 66dp safe circle (626px of 1024). The mark's farthest point is about 59 units from its centre.
const outputs: Record<string, { svg: string; opaque: boolean }> = {
  'icon-1024': { svg: svg(`<rect width="1024" height="1024" fill="${background}"/>${placed(mark, 6)}`), opaque: true },
  'android-adaptive-foreground': { svg: svg(placed(mark, 5)), opaque: false },
  'android-adaptive-background': { svg: svg(`<rect width="1024" height="1024" fill="${background}"/>`), opaque: true },
  'android-adaptive-monochrome': { svg: svg(placed(silhouette, 5)), opaque: false }
};

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const render = async (markup: string, file: string, size: number, opaque: boolean) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator('svg').screenshot({ path: file, omitBackground: !opaque });
};
for (const [name, { svg: markup, opaque }] of Object.entries(outputs)) {
  writeFileSync(resolve(outDir, `${name}.svg`), markup);
  await render(markup, resolve(outDir, `${name}.png`), 1024, opaque);
}
for (const [file, viewBox] of [['fox-mark', '0 0 120 120'], ['fox-mascot', '0 0 240 280']] as const) {
  const [, , w, h] = viewBox.split(' ').map(Number);
  const height = Math.round((512 * h) / w);
  const markup = readFileSync(resolve(brandDir, `${file}.svg`), 'utf8').replace('<svg ', `<svg width="512" height="${height}" `);
  await page.setViewportSize({ width: 512, height });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator('svg').screenshot({ path: resolve(brandDir, `${file}-512.png`), omitBackground: true });
}
await browser.close();
console.log(`Exported app icons with the ${palette} background (${background}) to ${outDir}`);
