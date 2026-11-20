import type { DeliveryAddress } from './address.ts';

/**
 * Log-safe form of an address: the country code and the first two postal digits, e.g. `SK 81***`.
 * The output is derived from `countryCode` and `postalCode` only, so street, house number, city and instructions never reach it.
 */
export function redactAddress(address: Partial<DeliveryAddress> | null | undefined): string {
  const country = typeof address?.countryCode === 'string' ? address.countryCode.trim().toUpperCase() : '';
  const digits = typeof address?.postalCode === 'string' ? address.postalCode.replace(/\D/g, '') : '';
  const safeCountry = /^[A-Z]{2}$/.test(country) ? country : '--';
  if (digits.length < 4 || digits.length > 5) return `${safeCountry} ***`;
  return `${safeCountry} ${digits.slice(0, 2)}${'*'.repeat(digits.length - 2)}`;
}
