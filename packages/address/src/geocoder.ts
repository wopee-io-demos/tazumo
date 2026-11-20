import { validateAddress, type AddressError, type AddressMarket, type DeliveryAddress } from './address.ts';
import { checkDelivery, type DeliveryCheck, type DeliveryZone, type GeoPoint } from './delivery.ts';

export type GeocodePrecision = 'address' | 'street' | 'postal_code';

/** `unavailable` covers provider errors, timeouts and rate limits; it never means the address does not exist. */
export type GeocodeResult =
  | { status: 'found'; point: GeoPoint; precision: GeocodePrecision }
  | { status: 'not_found' }
  | { status: 'unavailable' };

/** Port for a geocoding provider (ADR-0023). Implementations receive validated, normalized addresses and must not log them. */
export interface Geocoder {
  geocode(address: DeliveryAddress): Promise<GeocodeResult>;
}

export type AddressDelivery =
  | { status: 'invalid'; errors: AddressError[] }
  | { status: 'not_found' }
  | { status: 'unavailable' }
  | { status: 'found'; point: GeoPoint; precision: GeocodePrecision; delivery: DeliveryCheck };

/** Validates the address for its market, geocodes it and checks it against merchant delivery zones. */
export async function resolveAddressDelivery(
  geocoder: Geocoder,
  market: AddressMarket,
  input: unknown,
  zones: DeliveryZone[],
): Promise<AddressDelivery> {
  const validation = validateAddress(market, input);
  if (!validation.ok) return { status: 'invalid', errors: validation.errors };
  const result = await geocoder.geocode(validation.address);
  if (result.status !== 'found') return { status: result.status };
  return { status: 'found', point: result.point, precision: result.precision, delivery: checkDelivery(zones, result.point) };
}
