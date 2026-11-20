export const addressMarkets = ['SK', 'CZ', 'DE', 'AT'] as const;
export type AddressMarket = (typeof addressMarkets)[number];

/** Mirrors `DeliveryAddress` in contracts/openapi.json. */
export type DeliveryAddress = {
  countryCode: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  instructions?: string;
};

export type AddressField = keyof DeliveryAddress;
export type AddressErrorCode =
  | 'required'
  | 'invalid_type'
  | 'too_long'
  | 'invalid_characters'
  | 'invalid_format'
  | 'unsupported_country'
  | 'market_mismatch'
  | 'unknown_field';
export type AddressError = { path: string; code: AddressErrorCode };
export type AddressValidation = { ok: true; address: DeliveryAddress } | { ok: false; errors: AddressError[] };

export const addressFields = ['countryCode', 'postalCode', 'addressLine1', 'addressLine2', 'city', 'instructions'] as const;
export const requiredAddressFields = ['countryCode', 'postalCode', 'addressLine1', 'city'] as const;

export const addressMaxLength: Readonly<Record<AddressField, number>> = {
  countryCode: 2,
  postalCode: 10,
  addressLine1: 120,
  addressLine2: 120,
  city: 80,
  instructions: 500,
};

const postalPatterns: Readonly<Record<AddressMarket, RegExp>> = {
  SK: /^\d{3} \d{2}$/,
  CZ: /^\d{3} \d{2}$/,
  DE: /^\d{5}$/,
  AT: /^\d{4}$/,
};

/** C0/C1 controls plus zero-width and bidirectional formatting characters. Instructions may contain tab and line breaks. */
const forbiddenInLine = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
const forbiddenInInstructions = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;

export const isAddressMarket = (value: unknown): value is AddressMarket =>
  typeof value === 'string' && (addressMarkets as readonly string[]).includes(value);

const tidy = (value: string) => value.normalize('NFC').replace(/[\s ]+/g, ' ').trim();

function normalizePostalCode(countryCode: string, postalCode: string): string {
  const compact = postalCode.replace(/[\s ]+/g, '');
  if ((countryCode === 'SK' || countryCode === 'CZ') && /^\d{5}$/.test(compact)) return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  if (countryCode === 'DE' || countryCode === 'AT') return compact;
  return tidy(postalCode);
}

/** Trims and collapses whitespace, applies Unicode NFC (diacritics are kept), upper-cases the country and formats the postal code. Idempotent. */
export function normalizeAddress(address: DeliveryAddress): DeliveryAddress {
  const countryCode = tidy(address.countryCode).toUpperCase();
  const normalized: DeliveryAddress = {
    countryCode,
    postalCode: normalizePostalCode(countryCode, address.postalCode),
    addressLine1: tidy(address.addressLine1),
    city: tidy(address.city),
  };
  const line2 = address.addressLine2 === undefined ? '' : tidy(address.addressLine2);
  if (line2) normalized.addressLine2 = line2;
  const instructions = address.instructions === undefined ? '' : address.instructions.normalize('NFC').trim();
  if (instructions) normalized.instructions = instructions;
  return normalized;
}

/** Validates an untrusted address for a market. On success, returns the normalized address. */
export function validateAddress(market: AddressMarket, input: unknown): AddressValidation {
  if (!isAddressMarket(market)) return { ok: false, errors: [{ path: 'market', code: 'unsupported_country' }] };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: [{ path: '', code: 'invalid_type' }] };
  const record = input as Record<string, unknown>;
  const errors: AddressError[] = [];
  for (const key of Object.keys(record)) {
    if (!(addressFields as readonly string[]).includes(key)) errors.push({ path: key, code: 'unknown_field' });
  }
  for (const field of addressFields) {
    const value = record[field];
    const required = (requiredAddressFields as readonly string[]).includes(field);
    if (value === undefined) {
      if (required) errors.push({ path: field, code: 'required' });
      continue;
    }
    if (typeof value !== 'string') errors.push({ path: field, code: 'invalid_type' });
    else if ((field === 'instructions' ? forbiddenInInstructions : forbiddenInLine).test(value)) errors.push({ path: field, code: 'invalid_characters' });
    else if (required && !tidy(value)) errors.push({ path: field, code: 'required' });
  }
  if (errors.length) return { ok: false, errors };

  const address = normalizeAddress(record as DeliveryAddress);
  for (const field of addressFields) {
    const value = address[field];
    if (value !== undefined && [...value].length > addressMaxLength[field]) errors.push({ path: field, code: 'too_long' });
  }
  if (!isAddressMarket(address.countryCode)) errors.push({ path: 'countryCode', code: 'unsupported_country' });
  else if (address.countryCode !== market) errors.push({ path: 'countryCode', code: 'market_mismatch' });
  else if (!postalPatterns[market].test(address.postalCode)) errors.push({ path: 'postalCode', code: 'invalid_format' });
  return errors.length ? { ok: false, errors } : { ok: true, address };
}
