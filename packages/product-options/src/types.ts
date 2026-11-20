export type SelectionMode = 'single' | 'multiple';

export type Option = {
  id: string;
  labelKey: string;
  priceDeltaMinor: number;
  /** Resolved by the caller per quote, for example from `@tazumo/merchant-ops` `isAvailableAt`; not a stored attribute. */
  available: boolean;
  isDefault?: boolean;
};

export type OptionGroup = {
  id: string;
  labelKey: string;
  selection: SelectionMode;
  min: number;
  max: number;
  /** Must equal `min >= 1`. */
  required: boolean;
  options: readonly Option[];
};

export type ProductOptions = { productId: string; currency: string; groups: readonly OptionGroup[] };

/** Group ID to chosen option IDs. A group that is left out falls back to its available defaults. */
export type Selection = Readonly<Record<string, readonly string[]>>;

/** Same shape as `Money` in `@tazumo/commerce` and the OpenAPI `Money` schema. */
export type Money = { currency: string; minorUnits: number };

export type Path = readonly (string | number)[];

export type DefinitionErrorCode =
  | 'invalid_definition'
  | 'invalid_id'
  | 'invalid_currency'
  | 'invalid_label_key'
  | 'invalid_selection_mode'
  | 'invalid_required'
  | 'invalid_bound'
  | 'min_exceeds_max'
  | 'max_exceeds_options'
  | 'single_max_not_one'
  | 'required_min_mismatch'
  | 'duplicate_group_id'
  | 'duplicate_option_id'
  | 'invalid_price_delta'
  | 'invalid_availability'
  | 'invalid_default'
  | 'too_many_defaults'
  | 'defaults_below_min';

export type SelectionErrorCode =
  | 'invalid_selection'
  | 'unknown_group'
  | 'unknown_option'
  | 'option_wrong_group'
  | 'duplicate_option'
  | 'too_few_options'
  | 'too_many_options'
  | 'missing_required_group'
  | 'option_unavailable';

export type PricingErrorCode = 'invalid_base_price' | 'currency_mismatch' | 'invalid_quantity' | 'negative_unit_price' | 'amount_overflow';

export type ErrorCode = DefinitionErrorCode | SelectionErrorCode | PricingErrorCode;

export type OptionsError<C extends ErrorCode = ErrorCode> = { code: C; path: Path; message: string };

export type ResolvedSelection = Record<string, string[]>;

/** `definition` is a catalogue fault (server side); `selection` and `pricing` reject the request's input or the resulting amount. */
export type FailureStage = 'definition' | 'selection' | 'pricing';

export type Failure = { ok: false; stage: FailureStage; errors: OptionsError[] };

export type SelectionResult = { ok: true; selection: ResolvedSelection } | Failure;

export type BreakdownEntry = { groupId: string; optionId: string; labelKey: string; priceDeltaMinor: number };

export type PricedSelection = {
  ok: true;
  selection: ResolvedSelection;
  basePrice: Money;
  breakdown: BreakdownEntry[];
  unitPrice: Money;
  quantity: number;
  lineTotal: Money;
};

export type PriceResult = PricedSelection | Failure;
