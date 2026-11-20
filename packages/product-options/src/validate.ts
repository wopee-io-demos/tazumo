import type {
  DefinitionErrorCode,
  OptionGroup,
  OptionsError,
  Path,
  ProductOptions,
  ResolvedSelection,
  SelectionErrorCode,
  SelectionResult
} from './types.ts';

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CURRENCY = /^[A-Z]{3}$/;
const LABEL_KEY = /^\S+$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const shown = (id: string): string => (ID.test(id) ? id : `${id.slice(0, 32).replace(/[^\x20-\x7e]/g, '?')}${id.length > 32 ? '…' : ''}`);
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

type Add<C extends DefinitionErrorCode | SelectionErrorCode> = (code: C, path: Path, message: string) => void;

function collector<C extends DefinitionErrorCode | SelectionErrorCode>(): [OptionsError<C>[], Add<C>] {
  const errors: OptionsError<C>[] = [];
  return [errors, (code, path, message) => void errors.push({ code, path, message })];
}

/** Checks the shape and internal consistency of a definition. An empty list means it is valid. */
export function validateOptionGroups(def: unknown): OptionsError<DefinitionErrorCode>[] {
  const [errors, add] = collector<DefinitionErrorCode>();
  if (!isRecord(def)) {
    add('invalid_definition', [], 'The definition must be an object');
    return errors;
  }
  if (!isId(def.productId)) add('invalid_id', ['productId'], 'productId must be a lowercase identifier');
  if (typeof def.currency !== 'string' || !CURRENCY.test(def.currency)) add('invalid_currency', ['currency'], 'currency must be an ISO 4217 code');
  if (!Array.isArray(def.groups)) {
    add('invalid_definition', ['groups'], 'groups must be an array');
    return errors;
  }
  const groupIds = new Set<string>();
  const optionIds = new Set<string>();
  def.groups.forEach((group, g) => validateGroup(group, ['groups', g], groupIds, optionIds, add));
  return errors;
}

function validateGroup(group: unknown, path: Path, groupIds: Set<string>, optionIds: Set<string>, add: Add<DefinitionErrorCode>): void {
  if (!isRecord(group)) return add('invalid_definition', path, 'Each group must be an object');
  if (!isId(group.id)) add('invalid_id', [...path, 'id'], 'Group id must be a lowercase identifier');
  else if (groupIds.has(group.id)) add('duplicate_group_id', [...path, 'id'], `Group id "${group.id}" is used twice`);
  else groupIds.add(group.id);
  if (typeof group.labelKey !== 'string' || !LABEL_KEY.test(group.labelKey)) add('invalid_label_key', [...path, 'labelKey'], 'labelKey must be a non-empty key');
  if (group.selection !== 'single' && group.selection !== 'multiple') add('invalid_selection_mode', [...path, 'selection'], 'selection must be single or multiple');
  if (typeof group.required !== 'boolean') add('invalid_required', [...path, 'required'], 'required must be a boolean');

  const options = Array.isArray(group.options) ? group.options : null;
  if (!options || options.length === 0) add('invalid_definition', [...path, 'options'], 'options must be a non-empty array');
  const { min, max } = group;
  const minOk = isCount(min);
  const maxOk = isCount(max) && max >= 1;
  if (!minOk) add('invalid_bound', [...path, 'min'], 'min must be a non-negative integer');
  if (!maxOk) add('invalid_bound', [...path, 'max'], 'max must be a positive integer');
  if (minOk && maxOk) {
    if (min > max) add('min_exceeds_max', [...path, 'min'], 'min must not exceed max');
    if (options && options.length > 0 && max > options.length) add('max_exceeds_options', [...path, 'max'], 'max must not exceed the number of options');
    if (group.selection === 'single' && max !== 1) add('single_max_not_one', [...path, 'max'], 'A single-choice group must have max 1');
    if (typeof group.required === 'boolean' && group.required !== min >= 1) add('required_min_mismatch', [...path, 'required'], 'required must be true exactly when min is at least 1');
  }
  if (!options) return;
  let defaults = 0;
  options.forEach((option, o) => {
    if (validateOption(option, [...path, 'options', o], optionIds, add)) defaults += 1;
  });
  if (maxOk && defaults > max) add('too_many_defaults', [...path, 'options'], 'More options are marked default than max allows');
  if (minOk && defaults > 0 && defaults < min) add('defaults_below_min', [...path, 'options'], 'Defaults must reach min when any are set');
}

function validateOption(option: unknown, path: Path, optionIds: Set<string>, add: Add<DefinitionErrorCode>): boolean {
  if (!isRecord(option)) {
    add('invalid_definition', path, 'Each option must be an object');
    return false;
  }
  if (!isId(option.id)) add('invalid_id', [...path, 'id'], 'Option id must be a lowercase identifier');
  else if (optionIds.has(option.id)) add('duplicate_option_id', [...path, 'id'], `Option id "${option.id}" is used twice in this product`);
  else optionIds.add(option.id);
  if (typeof option.labelKey !== 'string' || !LABEL_KEY.test(option.labelKey)) add('invalid_label_key', [...path, 'labelKey'], 'labelKey must be a non-empty key');
  if (!Number.isSafeInteger(option.priceDeltaMinor)) add('invalid_price_delta', [...path, 'priceDeltaMinor'], 'priceDeltaMinor must be a safe integer');
  if (typeof option.available !== 'boolean') add('invalid_availability', [...path, 'available'], 'available must be a boolean');
  if (option.isDefault !== undefined && typeof option.isDefault !== 'boolean') add('invalid_default', [...path, 'isDefault'], 'isDefault must be a boolean');
  return option.isDefault === true;
}

/**
 * Validates a selection against a definition and resolves defaults. The resolved selection lists every group,
 * with option IDs in definition order, so it is the input to use for `lineKey`.
 */
export function validateSelection(def: ProductOptions, selection: unknown = {}): SelectionResult {
  const definitionErrors = validateOptionGroups(def);
  if (definitionErrors.length) return { ok: false, stage: 'definition', errors: definitionErrors };
  if (!isRecord(selection)) return { ok: false, stage: 'selection', errors: [{ code: 'invalid_selection', path: ['selection'], message: 'selection must be an object' }] };

  const [errors, add] = collector<SelectionErrorCode>();
  const ownerOf = new Map<string, string>();
  const groupIds = new Set<string>();
  for (const group of def.groups) {
    groupIds.add(group.id);
    for (const option of group.options) ownerOf.set(option.id, group.id);
  }
  for (const key of Object.keys(selection)) {
    if (!groupIds.has(key)) add('unknown_group', ['selection', key], `Group "${shown(key)}" is not offered for ${def.productId}`);
  }

  const resolved: ResolvedSelection = {};
  for (const group of def.groups) {
    const chosen = Object.hasOwn(selection, group.id)
      ? explicitChoice(group, selection[group.id], ownerOf, add)
      : defaultChoice(group, add);
    if (chosen) resolved[group.id] = group.options.filter((option) => chosen.has(option.id)).map((option) => option.id);
  }
  return errors.length ? { ok: false, stage: 'selection', errors } : { ok: true, selection: resolved };
}

function defaultChoice(group: OptionGroup, add: Add<SelectionErrorCode>): Set<string> | null {
  const chosen = new Set(group.options.filter((option) => option.isDefault === true && option.available).map((option) => option.id));
  const path = ['selection', group.id];
  if (chosen.size === 0 && group.required) {
    add('missing_required_group', path, `Group "${group.id}" is required and has no available default`);
    return null;
  }
  if (chosen.size < group.min) {
    add('too_few_options', path, `Group "${group.id}" needs at least ${group.min} options`);
    return null;
  }
  return chosen;
}

function explicitChoice(group: OptionGroup, value: unknown, ownerOf: Map<string, string>, add: Add<SelectionErrorCode>): Set<string> | null {
  const path = ['selection', group.id];
  if (!Array.isArray(value)) {
    add('invalid_selection', path, 'A group selection must be an array of option IDs');
    return null;
  }
  if (value.length > group.options.length) {
    add('too_many_options', path, `Group "${group.id}" allows at most ${group.max} options`);
    return null;
  }
  const chosen = new Set<string>();
  let failed = false;
  const reject: Add<SelectionErrorCode> = (code, at, message) => {
    failed = true;
    add(code, at, message);
  };
  value.forEach((id: unknown, i) => {
    const at = [...path, i];
    if (typeof id !== 'string') return reject('invalid_selection', at, 'Option IDs must be strings');
    if (chosen.has(id)) return reject('duplicate_option', at, `Option "${shown(id)}" is selected twice`);
    chosen.add(id);
    const owner = ownerOf.get(id);
    if (owner === undefined) return reject('unknown_option', at, `Option "${shown(id)}" does not exist`);
    if (owner !== group.id) return reject('option_wrong_group', at, `Option "${id}" belongs to group "${owner}"`);
    if (!group.options.find((option) => option.id === id)!.available) return reject('option_unavailable', at, `Option "${id}" is not available`);
  });
  if (failed) return null;
  if (chosen.size < group.min) {
    add('too_few_options', path, `Group "${group.id}" needs at least ${group.min} options`);
    return null;
  }
  if (chosen.size > group.max) {
    add('too_many_options', path, `Group "${group.id}" allows at most ${group.max} options`);
    return null;
  }
  return chosen;
}
