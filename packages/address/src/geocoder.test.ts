import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAddressDelivery, type Geocoder, type GeocodeResult } from './index.ts';
import { FixtureGeocoder, fixtureAddresses, fixtureMerchantZones } from './testing.ts';

const allZones = Object.values(fixtureMerchantZones);

test('the fixture geocoder returns stable points for every fixture, also for unnormalized input', async () => {
  const geocoder = new FixtureGeocoder();
  for (const { address, point } of Object.values(fixtureAddresses)) {
    assert.deepEqual(await geocoder.geocode(address), { status: 'found', point, precision: 'address' });
    assert.deepEqual(await geocoder.geocode(address), { status: 'found', point, precision: 'address' });
  }
  const sk = fixtureAddresses.skInside.address;
  assert.deepEqual(await geocoder.geocode({ ...sk, countryCode: 'sk', postalCode: '81101', addressLine1: ' FIKTÍVNA  7', city: 'vymyslené mesto' }), {
    status: 'found',
    point: fixtureAddresses.skInside.point,
    precision: 'address',
  });
});

test('one synthetic address is inside and one outside the merchant zone', async () => {
  const geocoder = new FixtureGeocoder();
  const inside = await resolveAddressDelivery(geocoder, 'SK', fixtureAddresses.skInside.address, [fixtureMerchantZones.SK]);
  assert.ok(inside.status === 'found' && inside.delivery.deliverable && inside.delivery.distanceMeters < 1_000, JSON.stringify(inside));
  assert.deepEqual(await resolveAddressDelivery(geocoder, 'SK', fixtureAddresses.skOutside.address, [fixtureMerchantZones.SK]), {
    status: 'found',
    point: fixtureAddresses.skOutside.point,
    precision: 'address',
    delivery: { deliverable: false, reason: 'outside_zone' },
  });
  for (const key of ['czInside', 'atInside'] as const) {
    const { address } = fixtureAddresses[key];
    const result = await resolveAddressDelivery(geocoder, address.countryCode, address, allZones);
    assert.ok(result.status === 'found' && result.delivery.deliverable, key);
  }
  const de = await resolveAddressDelivery(geocoder, 'DE', fixtureAddresses.deOutside.address, allZones);
  assert.ok(de.status === 'found' && !de.delivery.deliverable);
});

test('non-fixture addresses are not_found, never a guess', async () => {
  const geocoder = new FixtureGeocoder();
  const sk = fixtureAddresses.skInside.address;
  for (const address of [
    { ...sk, addressLine1: 'Fiktívna 8' },
    { ...sk, postalCode: '811 02' },
    { ...sk, city: 'Vymyslené Mesto 2' },
    { ...sk, countryCode: 'CZ' },
    { countryCode: 'SK', postalCode: '811 01', addressLine1: 'Hlavná 1', city: 'Bratislava' },
  ]) {
    assert.deepEqual(await geocoder.geocode(address), { status: 'not_found' }, address.addressLine1);
  }
  assert.deepEqual(await new FixtureGeocoder([]).geocode(sk), { status: 'not_found' });
});

test('invalid addresses never reach the geocoder, and provider outages stay distinct from not_found', async () => {
  const calls: unknown[] = [];
  const stub = (result: GeocodeResult): Geocoder => ({ geocode: async (address) => (calls.push(address), result) });
  const de = fixtureAddresses.deOutside.address;
  assert.deepEqual(await resolveAddressDelivery(stub({ status: 'not_found' }), 'DE', { ...de, postalCode: '1011' }, allZones), {
    status: 'invalid',
    errors: [{ path: 'postalCode', code: 'invalid_format' }],
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await resolveAddressDelivery(stub({ status: 'not_found' }), 'DE', { ...de, city: ' Beispielstadt ' }, allZones), { status: 'not_found' });
  assert.deepEqual(calls[0], de);
  assert.deepEqual(await resolveAddressDelivery(stub({ status: 'unavailable' }), 'DE', de, allZones), { status: 'unavailable' });
});

test('the geocoder hands out copies, so callers cannot corrupt the fixture table', async () => {
  const geocoder = new FixtureGeocoder();
  const first = await geocoder.geocode(fixtureAddresses.skInside.address);
  assert.ok(first.status === 'found');
  first.point.lat = 0;
  assert.deepEqual(await geocoder.geocode(fixtureAddresses.skInside.address), { status: 'found', point: fixtureAddresses.skInside.point, precision: 'address' });
});
