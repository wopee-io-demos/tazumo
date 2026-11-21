import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceMeters, resolveAddressDelivery } from '../src/index.ts';
import { NominatimGeocoder } from '../src/nominatim.ts';

const baseUrl = process.env.NOMINATIM_URL;
const skip = !baseUrl && 'NOMINATIM_URL is not set (self-hosted instance with the Bremen extract, see infra/geocoding)';

test('a public landmark address in the Bremen extract resolves to its house', { skip }, async () => {
  const geocoder = new NominatimGeocoder({ baseUrl: baseUrl!, timeoutMs: 5_000 });
  const result = await geocoder.geocode({ countryCode: 'DE', postalCode: '28195', addressLine1: 'Am Markt 21', city: 'Bremen' });
  assert.ok(result.status === 'found' && result.precision === 'address', JSON.stringify(result));
  assert.ok(distanceMeters(result.point, { lat: 53.0757, lng: 8.8072 }) < 300);
});

test('a fictional street is not_found, and the zone check uses the same point', { skip }, async () => {
  const geocoder = new NominatimGeocoder({ baseUrl: baseUrl!, timeoutMs: 5_000 });
  assert.deepEqual(await geocoder.geocode({ countryCode: 'DE', postalCode: '28195', addressLine1: 'Erfundene Straße 5', city: 'Beispielstadt' }), { status: 'not_found' });
  const zone = { center: { lat: 53.0793, lng: 8.8017 }, radiusMeters: 2_000 };
  const delivery = await resolveAddressDelivery(geocoder, 'DE', { countryCode: 'DE', postalCode: '28195', addressLine1: 'Am Markt 21', city: 'Bremen' }, [zone]);
  assert.ok(delivery.status === 'found' && delivery.delivery.deliverable, JSON.stringify(delivery));
});
