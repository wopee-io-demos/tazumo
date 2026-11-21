import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { palettes, preferredPalette, type PaletteName } from '../src/palettes.ts';
import { foxColors } from '../src/brand.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const brandDir = resolve(root, 'assets/brand');
const outDir = resolve(brandDir, 'app-icon');
const palette = (process.argv[2] ?? preferredPalette) as PaletteName;
if (!(palette in palettes)) throw new Error(`Unknown palette ${palette}. Use one of ${Object.keys(palettes).join(', ')}`);
const background = palettes[palette].primary;

const markSource = readFileSync(resolve(brandDir, 'fox-mark.svg'), 'utf8');
const mark = markSource.replace(/<svg[^>]*>/, '').replace(/<title[^>]*>[\s\S]*?<\/title>/, '').replace(/<\/svg>\s*$/, '');
const pointsOf = (fill: string) => {
  const match = new RegExp(`<polygon points="([^"]+)" fill="${fill}"`).exec(mark);
  if (!match) throw new Error(`fox-mark.svg has no polygon filled ${fill}`);
  return match[1];
};
const head = pointsOf(foxColors.fur);
const muzzleEdge = pointsOf(foxColors.cream).split(' ').slice(0, -1).join(' ');

// The cream outline keeps the fox at 3:1 or more against every palette primary (tested in brand.test.ts).
const outline = `<polygon points="${head}" fill="${foxColors.cream}" stroke="${foxColors.cream}" stroke-width="5" stroke-linejoin="round"/>`;
const silhouette = `<defs><mask id="cut"><g fill="#fff" stroke="none">${mark
  .replace(/fill="#(?!2A1A14)[0-9A-F]{6}"/gi, 'fill="#fff"')
  .replace(/#2A1A14/gi, '#000')}</g><polyline points="${muzzleEdge}" fill="none" stroke="#000" stroke-width="3"/></mask></defs><rect width="120" height="120" fill="#FFFFFF" mask="url(#cut)"/>`;

const markCentre = { x: 60, y: 59 };
const placed = (content: string, scale: number) =>
  `<g transform="translate(512 512) scale(${scale}) translate(${-markCentre.x} ${-markCentre.y})">${content}</g>`;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>\n`;

// Android adaptive icons: 108dp canvas with a 66dp safe circle (313px radius at 1024px). The outlined mark reaches about 61 units from its centre.
const adaptiveScale = 4.8;
const outputs: Record<string, { svg: string; opaque: boolean }> = {
  'icon-1024': { svg: svg(`<rect width="1024" height="1024" fill="${background}"/>${placed(outline + mark, 6)}`), opaque: true },
  'android-adaptive-foreground': { svg: svg(placed(outline + mark, adaptiveScale)), opaque: false },
  'android-adaptive-background': { svg: svg(`<rect width="1024" height="1024" fill="${background}"/>`), opaque: true },
  'android-adaptive-monochrome': { svg: svg(placed(silhouette, adaptiveScale)), opaque: false }
};

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const render = async (markup: string, file: string, width: number, height: number, opaque: boolean) => {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator('svg').screenshot({ path: file, omitBackground: !opaque });
};
for (const [name, { svg: markup, opaque }] of Object.entries(outputs)) {
  writeFileSync(resolve(outDir, `${name}.svg`), markup);
  await render(markup, resolve(outDir, `${name}.png`), 1024, 1024, opaque);
}
for (const file of ['fox-mark', 'fox-mascot']) {
  const source = readFileSync(resolve(brandDir, `${file}.svg`), 'utf8');
  const [, , w, h] = /viewBox="([^"]+)"/.exec(source)![1].split(' ').map(Number);
  const height = Math.round((512 * h) / w);
  await render(source.replace('<svg ', `<svg width="512" height="${height}" `), resolve(brandDir, `${file}-512.png`), 512, height, false);
}
await browser.close();
console.log(`Exported app icons with the ${palette} background (${background}) to ${outDir}`);
