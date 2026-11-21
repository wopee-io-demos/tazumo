import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceMeters, resolveAddressDelivery } from '../src/index.ts';
import { NominatimGeocoder } from '../src/nominatim.ts';

const baseUrl = process.env.NOMINATIM_URL;
const skip = !baseUrl && 'NOMINATIM_URL is not set (self-hosted instance with the Vienna extract, see infra/geocoding)';
const cityHall = { countryCode: 'AT', postalCode: '1010', addressLine1: 'Friedrich-Schmidt-Platz 1', city: 'Wien' };

test('a public landmark address in the Vienna extract resolves to its house', { skip }, async () => {
  const geocoder = new NominatimGeocoder({ baseUrl: baseUrl!, timeoutMs: 5_000 });
  const result = await geocoder.geocode(cityHall);
  assert.ok(result.status === 'found' && result.precision === 'address', JSON.stringify(result));
  assert.ok(distanceMeters(result.point, { lat: 48.2108, lng: 16.3572 }) < 300, JSON.stringify(result));
});

test('a fictional street is not_found, and the zone check uses the same point', { skip }, async () => {
  const geocoder = new NominatimGeocoder({ baseUrl: baseUrl!, timeoutMs: 5_000 });
  assert.deepEqual(await geocoder.geocode({ countryCode: 'AT', postalCode: '1010', addressLine1: 'Fiktivgasse 2', city: 'Musterdorf' }), { status: 'not_found' });
  const zone = { center: { lat: 48.2085, lng: 16.3731 }, radiusMeters: 2_000 };
  const delivery = await resolveAddressDelivery(geocoder, 'AT', cityHall, [zone]);
  assert.ok(delivery.status === 'found' && delivery.delivery.deliverable, JSON.stringify(delivery));
});
