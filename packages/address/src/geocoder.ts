import { normalizeAddress, validateAddress, type AddressError, type AddressMarket, type DeliveryAddress } from './address.ts';
import { checkDelivery, type DeliveryCheck, type DeliveryZone, type GeoPoint } from './delivery.ts';

export type GeocodeResult =
  | { status: 'found'; point: GeoPoint; precision: 'address' }
  | { status: 'not_found' };

/** Port for a geocoding provider (ADR-0023). Implementations receive validated, normalized addresses and must not log them. */
export interface Geocoder {
  geocode(address: DeliveryAddress): Promise<GeocodeResult>;
}

export type FixtureAddress = { address: DeliveryAddress; point: GeoPoint };

const fixtureKey = (address: DeliveryAddress) => {
  const a = normalizeAddress(address);
  return [a.countryCode, a.postalCode, a.addressLine1, a.city].map((part) => part.toLowerCase()).join('\u0000');
};

/** Synthetic delivery zone of a fictional merchant, for fixtures and tests only. */
export const fixtureMerchantZone: DeliveryZone = { center: { lat: 48.1486, lng: 17.1077 }, radiusMeters: 5_000 };

/**
 * Clearly fictional addresses. None of them is a real place. `inside` points lie within `fixtureMerchantZone`,
 * `outside` points lie about 25 km away from it.
 */
export const fixtureAddresses = {
  skInside: { address: { countryCode: 'SK', postalCode: '811 01', addressLine1: 'Fiktívna 7', city: 'Vymyslené Mesto' }, point: { lat: 48.1512, lng: 17.1123 } },
  skOutside: { address: { countryCode: 'SK', postalCode: '900 99', addressLine1: 'Neexistujúca 99', city: 'Vymyslené Mesto' }, point: { lat: 48.3736, lng: 17.1077 } },
  czInside: { address: { countryCode: 'CZ', postalCode: '110 00', addressLine1: 'Smyšlená 3', city: 'Fiktivní Město' }, point: { lat: 48.142, lng: 17.099 } },
  deOutside: { address: { countryCode: 'DE', postalCode: '10115', addressLine1: 'Erfundene Straße 5', city: 'Beispielstadt' }, point: { lat: 48.1486, lng: 17.4450 } },
  atInside: { address: { countryCode: 'AT', postalCode: '1010', addressLine1: 'Fiktivgasse 2', city: 'Musterdorf' }, point: { lat: 48.155, lng: 17.12 } },
} as const satisfies Record<string, FixtureAddress>;

/** Deterministic, offline geocoder. Resolves only the listed fixtures and returns `not_found` for anything else, never a guess. */
export class FixtureGeocoder implements Geocoder {
  readonly #points = new Map<string, GeoPoint>();

  constructor(fixtures: readonly FixtureAddress[] = Object.values(fixtureAddresses)) {
    for (const { address, point } of fixtures) this.#points.set(fixtureKey(address), { ...point });
  }

  async geocode(address: DeliveryAddress): Promise<GeocodeResult> {
    const point = this.#points.get(fixtureKey(address));
    return point ? { status: 'found', point: { ...point }, precision: 'address' } : { status: 'not_found' };
  }
}

export type AddressDelivery =
  | { status: 'invalid'; errors: AddressError[] }
  | { status: 'not_found' }
  | { status: 'found'; point: GeoPoint; delivery: DeliveryCheck };

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
  if (result.status !== 'found') return { status: 'not_found' };
  return { status: 'found', point: result.point, delivery: checkDelivery(zones, result.point) };
}
