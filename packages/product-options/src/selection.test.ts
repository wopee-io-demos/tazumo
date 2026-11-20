import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticOptionsFor, validateSelection } from './index.ts';
import type { ProductOptions } from './index.ts';

const pizza = syntheticOptionsFor('pizza')!;
const burger = syntheticOptionsFor('burger')!;
const errors = (def: ProductOptions, selection: unknown) => {
  const result = validateSelection(def, selection);
  assert.equal(result.ok, false);
  return result.ok ? [] : result.errors.map(({ code, path }) => ({ code, path }));
};
const resolved = (def: ProductOptions, selection?: unknown) => {
  const result = validateSelection(def, selection);
  assert.ok(result.ok, JSON.stringify(result));
  return result.selection;
};

test('applies available defaults to groups that are left out', () => {
  assert.deepEqual(resolved(pizza), { size: ['medium'], extras: [] });
  assert.deepEqual(resolved(pizza, {}), { size: ['medium'], extras: [] });
  assert.deepEqual(resolved(burger, { toppings: ['bacon'] }), { sauce: ['house-sauce'], toppings: ['bacon'] });
});

test('an explicit empty optional group overrides its default', () => {
  assert.deepEqual(resolved(burger, { sauce: [] }), { sauce: [], toppings: [] });
});

test('a multiple group with max 3 accepts 0 to 3 options and returns them in definition order', () => {
  assert.deepEqual(resolved(pizza, { extras: [] }).extras, []);
  assert.deepEqual(resolved(pizza, { extras: ['olives'] }).extras, ['olives']);
  assert.deepEqual(resolved(pizza, { extras: ['chilli-oil', 'olives'] }).extras, ['olives', 'chilli-oil']);
  assert.deepEqual(resolved(pizza, { extras: ['extra-mozzarella', 'mushrooms', 'olives'] }).extras, ['olives', 'mushrooms', 'extra-mozzarella']);
});

test('rejects a selection that is not an object', () => {
  for (const value of [null, ['size'], 'size']) assert.deepEqual(errors(pizza, value), [{ code: 'invalid_selection', path: ['selection'] }]);
});

test('each invalid choice has its own code and path', () => {
  assert.deepEqual(errors(pizza, { crust: ['thin'] }), [{ code: 'unknown_group', path: ['selection', 'crust'] }]);
  assert.deepEqual(errors(pizza, { size: 'large' }), [{ code: 'invalid_selection', path: ['selection', 'size'] }]);
  assert.deepEqual(errors(pizza, { extras: [7] }), [{ code: 'invalid_selection', path: ['selection', 'extras', 0] }]);
  assert.deepEqual(errors(pizza, { size: ['huge'] }), [{ code: 'unknown_option', path: ['selection', 'size', 0] }]);
  assert.deepEqual(errors(pizza, { size: ['olives'] }), [{ code: 'option_wrong_group', path: ['selection', 'size', 0] }]);
  assert.deepEqual(errors(pizza, { extras: ['olives', 'olives'] }), [{ code: 'duplicate_option', path: ['selection', 'extras', 1] }]);
  assert.deepEqual(errors(pizza, { size: [] }), [{ code: 'too_few_options', path: ['selection', 'size'] }]);
  assert.deepEqual(errors(pizza, { size: ['small', 'large'] }), [{ code: 'too_many_options', path: ['selection', 'size'] }]);
  assert.deepEqual(errors(pizza, { extras: ['olives', 'mushrooms', 'extra-mozzarella', 'chilli-oil'] }), [{ code: 'too_many_options', path: ['selection', 'extras'] }]);
  assert.deepEqual(errors(pizza, { extras: ['truffle'] }), [{ code: 'option_unavailable', path: ['selection', 'extras', 0] }]);
});

test('reports every problem across groups in one pass', () => {
  assert.deepEqual(errors(pizza, { size: ['olives'], extras: ['truffle', 'nope'], crust: [] }), [
    { code: 'unknown_group', path: ['selection', 'crust'] },
    { code: 'option_wrong_group', path: ['selection', 'size', 0] },
    { code: 'option_unavailable', path: ['selection', 'extras', 0] },
    { code: 'unknown_option', path: ['selection', 'extras', 1] }
  ]);
});

test('does not treat inherited keys as a group selection', () => {
  const inherited = Object.create({ size: ['large'] }) as Record<string, string[]>;
  assert.deepEqual(resolved(pizza, inherited), { size: ['medium'], extras: [] });
});

const custom = (overrides: Record<string, unknown>, options = [
  { id: 'a', labelKey: 'options.a', priceDeltaMinor: 0, available: true, isDefault: true },
  { id: 'b', labelKey: 'options.b', priceDeltaMinor: 0, available: true },
  { id: 'c', labelKey: 'options.c', priceDeltaMinor: 0, available: true }
]): ProductOptions => ({
  productId: 'bowl',
  currency: 'EUR',
  groups: [{ id: 'mix', labelKey: 'options.mix', selection: 'multiple', min: 1, max: 3, required: true, options, ...overrides }]
});

test('a required group without an available default is missing when left out', () => {
  const noDefault = custom({ max: 2 }, [
    { id: 'a', labelKey: 'options.a', priceDeltaMinor: 0, available: true },
    { id: 'b', labelKey: 'options.b', priceDeltaMinor: 0, available: true }
  ]);
  assert.deepEqual(errors(noDefault, {}), [{ code: 'missing_required_group', path: ['selection', 'mix'] }]);
  const unavailableDefault = custom({ max: 2 }, [
    { id: 'a', labelKey: 'options.a', priceDeltaMinor: 0, available: false, isDefault: true },
    { id: 'b', labelKey: 'options.b', priceDeltaMinor: 0, available: true }
  ]);
  assert.deepEqual(errors(unavailableDefault, {}), [{ code: 'missing_required_group', path: ['selection', 'mix'] }]);
  assert.deepEqual(resolved(unavailableDefault, { mix: ['b'] }), { mix: ['b'] });
});

test('defaults that do not reach min are too few', () => {
  assert.deepEqual(errors(custom({ min: 2 }), {}), [{ code: 'too_few_options', path: ['selection', 'mix'] }]);
  assert.deepEqual(resolved(custom({ min: 2 }), { mix: ['c', 'a'] }), { mix: ['a', 'c'] });
});

test('an invalid definition is reported before the selection is checked', () => {
  const broken = custom({ max: 9 });
  const result = validateSelection(broken, { mix: ['a'] });
  assert.deepEqual(result.ok ? [] : result.errors.map((error) => error.code), ['max_exceeds_options']);
});
