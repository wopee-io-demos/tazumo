import test from 'node:test';
import assert from 'node:assert/strict';
import { lineKey } from './index.ts';
import type { Selection } from './index.ts';

test('is identical for the same selection in any group or option order', () => {
  const key = lineKey('pizza', { size: ['large'], extras: ['olives', 'mushrooms'] });
  assert.equal(lineKey('pizza', { extras: ['mushrooms', 'olives'], size: ['large'] }), key);
  assert.equal(lineKey('pizza', { extras: ['olives', 'mushrooms'], size: ['large'] }), key);
});

test('differs for different selections and products', () => {
  const keys = new Set([
    lineKey('pizza', { size: ['large'], extras: ['olives'] }),
    lineKey('pizza', { size: ['large'], extras: ['mushrooms'] }),
    lineKey('pizza', { size: ['small'], extras: ['olives'] }),
    lineKey('pizza', { size: ['large'] }),
    lineKey('pizza', { size: ['large'], extras: [] }),
    lineKey('pizza', {}),
    lineKey('burger', { size: ['large'], extras: ['olives'] })
  ]);
  assert.equal(keys.size, 7);
});

test('cannot be confused by delimiter characters in IDs', () => {
  assert.notEqual(lineKey('pizza', { a: ['b,c'] }), lineKey('pizza', { a: ['b', 'c'] }));
  assert.notEqual(lineKey('pizza|a', { b: ['c'] }), lineKey('pizza', { 'a|b': ['c'] }));
});

test('does not mutate the selection it was given', () => {
  const selection = { extras: ['olives', 'mushrooms'] };
  lineKey('pizza', selection);
  assert.deepEqual(selection.extras, ['olives', 'mushrooms']);
});

test('rejects malformed input', () => {
  assert.throws(() => lineKey('', {}), TypeError);
  assert.throws(() => lineKey(7 as unknown as string, {}), TypeError);
  assert.throws(() => lineKey('pizza', null as unknown as Selection), TypeError);
  assert.throws(() => lineKey('pizza', { size: 'large' } as unknown as Selection), TypeError);
  assert.throws(() => lineKey('pizza', { size: [1] } as unknown as Selection), TypeError);
});
