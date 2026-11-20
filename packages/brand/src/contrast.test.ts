import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, isLargeText, meetsContrast, minimumContrast, parseHex } from './contrast.ts';
import { palettes } from './palettes.ts';
import { colorModes, contrastPairings, themes, type ColorRole } from './themes.ts';

const round = (n: number) => Math.round(n * 100) / 100;

test('contrast ratio matches WCAG reference values', () => {
  assert.equal(round(contrastRatio('#000000', '#FFFFFF')), 21);
  assert.equal(round(contrastRatio('#FFFFFF', '#FFFFFF')), 1);
  assert.equal(round(contrastRatio('#767676', '#FFFFFF')), 4.54);
  assert.equal(contrastRatio('#123456', '#ABCDEF'), contrastRatio('#ABCDEF', '#123456'));
  assert.throws(() => parseHex('#FFF'));
});

test('thresholds follow WCAG 2.2 AA', () => {
  assert.deepEqual(minimumContrast, { text: 4.5, largeText: 3, ui: 3 });
  assert.equal(meetsContrast('#767676', '#FFFFFF', 'text'), true);
  assert.equal(meetsContrast('#777777', '#FFFFFF', 'text'), false);
  assert.equal(meetsContrast('#949494', '#FFFFFF', 'largeText'), true);
  assert.equal(isLargeText(24, 400), true);
  assert.equal(isLargeText(19, 700), true);
  assert.equal(isLargeText(18.66, 700), false);
  assert.equal(isLargeText(56 / 3, 700), true);
  assert.equal(isLargeText(22, 400), false);
});

test('every palette has a light and dark theme and nothing else', () => {
  assert.deepEqual(Object.keys(themes).sort(), Object.keys(palettes).sort());
  for (const modes of Object.values(themes)) assert.deepEqual(Object.keys(modes).sort(), [...colorModes].sort());
});

test('every colour role is a valid hex value and is covered by at least one pairing', () => {
  const covered = new Set<ColorRole>(contrastPairings.flatMap(p => [p.foreground, p.background]));
  for (const [palette, modes] of Object.entries(themes)) {
    for (const [mode, colors] of Object.entries(modes)) {
      for (const [role, value] of Object.entries(colors)) {
        assert.doesNotThrow(() => parseHex(value), `${palette}.${mode}.${role}`);
        assert.ok(covered.has(role as ColorRole), `${role} has no contrast pairing`);
      }
    }
  }
});

test('every foreground/background pairing in every palette and mode meets WCAG 2.2 AA', () => {
  const failures: string[] = [];
  for (const [palette, modes] of Object.entries(themes)) {
    for (const [mode, colors] of Object.entries(modes)) {
      for (const { foreground, background, use } of contrastPairings) {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        if (ratio < minimumContrast[use]) failures.push(`${palette}/${mode}: ${foreground} ${colors[foreground]} on ${background} ${colors[background]} = ${ratio.toFixed(2)} < ${minimumContrast[use]} (${use})`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('legacy palette pairings used by the apps meet WCAG 2.2 AA', () => {
  const failures: string[] = [];
  for (const [name, p] of Object.entries(palettes)) {
    const pairs: [string, string, string][] = [
      ['white on primary', '#FFFFFF', p.primary],
      ['primary on background', p.primary, p.background],
      ['primary on white', p.primary, '#FFFFFF'],
      ['ink on background', p.ink, p.background],
      ['ink on white', p.ink, '#FFFFFF'],
      ['ink on accent', p.ink, p.accent]
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < minimumContrast.text) failures.push(`${name}: ${label} = ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, []);
});
