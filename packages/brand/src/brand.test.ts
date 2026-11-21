import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as brand from './index.ts';

test('legacy exports keep their names and values', () => {
  assert.equal(brand.brandName, 'Tazumo');
  assert.equal(brand.preferredPalette, 'violet');
  assert.equal(brand.mascot, 'fox');
  assert.deepEqual(brand.palettes, {
    violet: { primary: '#6928E8', accent: '#F93C98', background: '#F5F0FF', ink: '#211239' },
    coral: { primary: '#BF3F24', accent: '#FFC857', background: '#FFF8F0', ink: '#342039' },
    emerald: { primary: '#087F62', accent: '#C9EF67', background: '#F4FAF5', ink: '#173D33' },
    midnight: { primary: '#252D37', accent: '#C4F455', background: '#F6F7F1', ink: '#161F27' }
  });
});

test('light themes keep the legacy brand colours', () => {
  for (const name of brand.paletteNames) {
    const legacy = brand.palettes[name], light = brand.themes[name].light;
    assert.equal(light.primary, legacy.primary);
    assert.equal(light.accent, legacy.accent);
    assert.equal(light.tint, legacy.background);
    assert.equal(light.text, legacy.ink);
  }
});

test('name, palette and mascot change independently', () => {
  const base = brand.createBrand();
  const renamed = brand.createBrand({ name: 'Zopiku' });
  const repainted = brand.createBrand({ palette: 'emerald' });
  const noMascot = brand.createBrand({ mascot: 'none' });

  assert.equal(renamed.name, 'Zopiku');
  assert.deepEqual({ ...renamed, name: base.name }, base);

  assert.equal(repainted.theme, brand.themes.emerald);
  assert.equal(repainted.name, base.name);
  assert.equal(repainted.mascotDefinition, base.mascotDefinition);

  assert.equal(noMascot.mascotDefinition.assets, null);
  assert.equal(noMascot.name, base.name);
  assert.equal(noMascot.theme, base.theme);
});

test('invalid brand configuration is rejected', () => {
  assert.throws(() => brand.createBrand({ name: ' ' }));
  assert.throws(() => brand.createBrand({ palette: 'neon' as brand.PaletteName }));
  assert.throws(() => brand.createBrand({ mascot: 'owl' as brand.MascotId }));
  assert.equal(Object.isFrozen(brand.defaultBrandConfig), true);
});

test('css variables are derived from semantic roles', () => {
  const vars = brand.toCssVariables(brand.getTheme('coral', 'dark'));
  assert.equal(vars['--tz-color-on-primary'], brand.themes.coral.dark.onPrimary);
  assert.equal(Object.keys(vars).length, Object.keys(brand.themes.coral.dark).length);
});

test('fox artwork uses only the fox colours and stays visible on every palette icon background', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['fox-mark.svg', 'fox-mascot.svg']) {
    const source = readFileSync(new URL(`../../../assets/brand/${file}`, import.meta.url), 'utf8');
    const used = new Set((source.match(/#[0-9A-F]{6}/gi) ?? []).map(c => c.toUpperCase()));
    const allowed = new Set([...Object.values(brand.foxColors), '#FFFFFF']);
    for (const colour of used) assert.ok(allowed.has(colour), `${file} uses ${colour}`);
  }
  for (const name of brand.paletteNames) {
    assert.ok(brand.meetsContrast(brand.foxColors.cream, brand.palettes[name].primary, 'ui'), `fox outline on ${name} icon background`);
  }
});
