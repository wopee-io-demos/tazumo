import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptionGroups } from './index.ts';
import type { OptionGroup, ProductOptions } from './index.ts';

const option = (id: string, extra: Record<string, unknown> = {}) => ({ id, labelKey: `options.${id}`, priceDeltaMinor: 0, available: true, ...extra });
const group = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'size',
  labelKey: 'options.size',
  selection: 'single',
  min: 1,
  max: 1,
  required: true,
  options: [option('small'), option('large')],
  ...extra
});
const def = (...groups: unknown[]): Record<string, unknown> => ({ productId: 'pizza', currency: 'EUR', groups });
const errors = (value: unknown) => validateOptionGroups(value).map(({ code, path }) => ({ code, path }));

test('a consistent definition has no errors, including a product without groups', () => {
  assert.deepEqual(errors(def(group(), group({ id: 'extras', selection: 'multiple', min: 0, max: 2, required: false, options: [option('olives'), option('basil', { isDefault: true })] }))), []);
  assert.deepEqual(errors(def()), []);
});

test('rejects a definition that is not an object or has no group array', () => {
  for (const value of [null, [], 'pizza', undefined]) assert.deepEqual(errors(value), [{ code: 'invalid_definition', path: [] }]);
  assert.deepEqual(errors({ productId: 'pizza', currency: 'EUR', groups: {} }), [{ code: 'invalid_definition', path: ['groups'] }]);
});

test('rejects a bad product id and a non-ISO currency', () => {
  for (const productId of ['', 'Pizza', 'pizza slice', 7]) {
    assert.deepEqual(errors({ ...def(), productId }), [{ code: 'invalid_id', path: ['productId'] }]);
  }
  for (const currency of ['eur', 'EURO', 978, undefined]) {
    assert.deepEqual(errors({ ...def(), currency }), [{ code: 'invalid_currency', path: ['currency'] }]);
  }
});

test('rejects malformed group fields with addressed paths', () => {
  const at = (field: string | number, ...rest: (string | number)[]) => ['groups', 0, field, ...rest];
  assert.deepEqual(errors(def('size')), [{ code: 'invalid_definition', path: ['groups', 0] }]);
  assert.deepEqual(errors(def(group({ id: 'Size' }))), [{ code: 'invalid_id', path: at('id') }]);
  assert.deepEqual(errors(def(group({ labelKey: '' }))), [{ code: 'invalid_label_key', path: at('labelKey') }]);
  assert.deepEqual(errors(def(group({ labelKey: 3 }))), [{ code: 'invalid_label_key', path: at('labelKey') }]);
  assert.deepEqual(errors(def(group({ selection: 'any' }))), [{ code: 'invalid_selection_mode', path: at('selection') }]);
  assert.deepEqual(errors(def(group({ required: 'yes' }))), [{ code: 'invalid_required', path: at('required') }]);
  assert.deepEqual(errors(def(group({ options: 'small' }))), [{ code: 'invalid_definition', path: at('options') }]);
  assert.deepEqual(errors(def(group({ options: [] }))), [{ code: 'invalid_definition', path: at('options') }]);
});

test('rejects bounds that are not integers or are out of range', () => {
  const at = (field: string) => ['groups', 0, field];
  for (const min of [-1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) assert.deepEqual(errors(def(group({ min }))), [{ code: 'invalid_bound', path: at('min') }]);
  for (const max of [0, '1', 1.5]) assert.deepEqual(errors(def(group({ max }))), [{ code: 'invalid_bound', path: at('max') }]);
});

test('rejects min above max, max above the option count, a single group with max other than 1 and required/min drift', () => {
  const at = (field: string) => ['groups', 0, field];
  const multiple = { selection: 'multiple', options: [option('a'), option('b'), option('c')] };
  assert.deepEqual(errors(def(group({ ...multiple, min: 3, max: 2 }))), [{ code: 'min_exceeds_max', path: at('min') }]);
  assert.deepEqual(errors(def(group({ ...multiple, max: 4 }))), [{ code: 'max_exceeds_options', path: at('max') }]);
  assert.deepEqual(errors(def(group({ max: 2 }))), [{ code: 'single_max_not_one', path: at('max') }]);
  assert.deepEqual(errors(def(group({ min: 0 }))), [{ code: 'required_min_mismatch', path: at('required') }]);
  assert.deepEqual(errors(def(group({ required: false }))), [{ code: 'required_min_mismatch', path: at('required') }]);
});

test('rejects duplicate group and option ids, within a group and across groups', () => {
  assert.deepEqual(errors(def(group(), group())), [
    { code: 'duplicate_group_id', path: ['groups', 1, 'id'] },
    { code: 'duplicate_option_id', path: ['groups', 1, 'options', 0, 'id'] },
    { code: 'duplicate_option_id', path: ['groups', 1, 'options', 1, 'id'] }
  ]);
  assert.deepEqual(errors(def(group({ options: [option('small'), option('small')] }))), [{ code: 'duplicate_option_id', path: ['groups', 0, 'options', 1, 'id'] }]);
});

test('rejects malformed options, including non-integer and unsafe deltas', () => {
  const at = (field?: string) => (field ? ['groups', 0, 'options', 0, field] : ['groups', 0, 'options', 0]);
  const withFirst = (value: unknown) => def(group({ options: [value, option('large')] }));
  assert.deepEqual(errors(withFirst(null)), [{ code: 'invalid_definition', path: at() }]);
  assert.deepEqual(errors(withFirst(option('Small'))), [{ code: 'invalid_id', path: at('id') }]);
  assert.deepEqual(errors(withFirst(option('small', { labelKey: 'two words' }))), [{ code: 'invalid_label_key', path: at('labelKey') }]);
  assert.deepEqual(errors(withFirst(option('small', { labelKey: null }))), [{ code: 'invalid_label_key', path: at('labelKey') }]);
  for (const priceDeltaMinor of [1.5, Number.MAX_SAFE_INTEGER + 1, -Number.MAX_SAFE_INTEGER - 1, Number.NaN, Infinity, '100', undefined]) {
    assert.deepEqual(errors(withFirst(option('small', { priceDeltaMinor }))), [{ code: 'invalid_price_delta', path: at('priceDeltaMinor') }]);
  }
  assert.deepEqual(errors(withFirst(option('small', { available: 'yes' }))), [{ code: 'invalid_availability', path: at('available') }]);
  assert.deepEqual(errors(withFirst(option('small', { isDefault: 'true' }))), [{ code: 'invalid_default', path: at('isDefault') }]);
});

test('rejects more defaults than max allows', () => {
  const twoDefaults = [option('small', { isDefault: true }), option('large', { isDefault: true })];
  assert.deepEqual(errors(def(group({ options: twoDefaults }))), [{ code: 'too_many_defaults', path: ['groups', 0, 'options'] }]);
  assert.deepEqual(errors(def(group({ options: twoDefaults, max: 0 }))), [{ code: 'invalid_bound', path: ['groups', 0, 'max'] }]);
});

test('rejects defaults that set some but fewer than min choices', () => {
  const options = [option('a', { isDefault: true }), option('b'), option('c')];
  assert.deepEqual(errors(def(group({ selection: 'multiple', min: 2, max: 3, options }))), [{ code: 'defaults_below_min', path: ['groups', 0, 'options'] }]);
  assert.deepEqual(errors(def(group({ selection: 'multiple', min: 2, max: 3, options: options.map((o) => ({ ...o, isDefault: true })) }))), []);
  assert.deepEqual(errors(def(group({ selection: 'multiple', min: 2, max: 2, options: [option('a'), option('b')] }))), []);
});

test('every error carries a message', () => {
  for (const error of validateOptionGroups(def(group({ id: '', min: 5, options: [{}] })))) assert.ok(error.message.length > 0);
});

test('accepts the public types', () => {
  const typed: ProductOptions = { productId: 'pizza', currency: 'EUR', groups: [group() as OptionGroup] };
  assert.deepEqual(validateOptionGroups(typed), []);
});
