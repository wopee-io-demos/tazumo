import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elevation, radius, spacing, touchTarget, typography } from './scales.ts';

const ascending = (values: number[]) => values.every((v, i) => i === 0 || v > values[i - 1]);

test('spacing and radius scales ascend and sit on the 2px/4px grid', () => {
  assert.ok(ascending(Object.values(spacing)));
  assert.ok(ascending(Object.values(radius)));
  for (const v of Object.values(spacing)) assert.equal(v % 2, 0);
});

test('type scale ascends and keeps readable line height', () => {
  const styles = Object.values(typography);
  assert.ok(ascending(styles.map(s => s.fontSize)));
  for (const s of styles) {
    assert.ok(s.fontSize >= 12, 'no text below 12px');
    assert.ok(s.lineHeight / s.fontSize >= 1.15, `line height for ${s.fontSize}px`);
  }
  assert.ok(typography.body.lineHeight / typography.body.fontSize >= 1.5, 'body copy line height at least 1.5');
});

test('elevation ascends and touch targets meet WCAG 2.2 SC 2.5.8', () => {
  const levels = Object.values(elevation);
  assert.ok(ascending(levels.map(l => l.native.elevation)));
  assert.equal(levels[0].css, 'none');
  assert.ok(touchTarget.minimum >= 24 && touchTarget.recommended >= 44);
});
