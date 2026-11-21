import { normalizeAddress, type AddressMarket, type DeliveryAddress } from './address.ts';
import type { DeliveryZone, GeoPoint } from './delivery.ts';
import type { GeocodeResult, Geocoder } from './geocoder.ts';

export type FixtureAddress = { address: DeliveryAddress; point: GeoPoint };

/** Synthetic delivery zones of fictional merchants, one per market. For fixtures and tests only. */
export const fixtureMerchantZones: Readonly<Record<AddressMarket, DeliveryZone>> = {
  SK: { center: { lat: 48.1486, lng: 17.1077 }, radiusMeters: 5_000 },
  CZ: { center: { lat: 49.1951, lng: 16.6068 }, radiusMeters: 5_000 },
  DE: { center: { lat: 52.52, lng: 13.405 }, radiusMeters: 5_000 },
  AT: { center: { lat: 48.2082, lng: 16.3738 }, radiusMeters: 5_000 },
};

/**
 * Clearly fictional addresses; none is a real place. `Inside` points lie within their market's fixture zone,
 * `Outside` points about 25 km from it.
 */
export const fixtureAddresses = {
  skInside: { address: { countryCode: 'SK', postalCode: '811 01', addressLine1: 'Fiktívna 7', city: 'Vymyslené Mesto' }, point: { lat: 48.1512, lng: 17.1123 } },
  skOutside: { address: { countryCode: 'SK', postalCode: '900 99', addressLine1: 'Neexistujúca 99', city: 'Vymyslené Mesto' }, point: { lat: 48.3736, lng: 17.1077 } },
  czInside: { address: { countryCode: 'CZ', postalCode: '602 00', addressLine1: 'Smyšlená 3', city: 'Fiktivní Město' }, point: { lat: 49.198, lng: 16.61 } },
  deOutside: { address: { countryCode: 'DE', postalCode: '10115', addressLine1: 'Erfundene Straße 5', city: 'Beispielstadt' }, point: { lat: 52.745, lng: 13.405 } },
  atInside: { address: { countryCode: 'AT', postalCode: '1010', addressLine1: 'Fiktivgasse 2', city: 'Musterdorf' }, point: { lat: 48.21, lng: 16.37 } },
} as const satisfies Record<string, FixtureAddress>;

const fixtureKey = (address: DeliveryAddress) => {
  const a = normalizeAddress(address);
  return [a.countryCode, a.postalCode, a.addressLine1, a.city].map((part) => part.toLowerCase()).join('\u0000');
};

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
