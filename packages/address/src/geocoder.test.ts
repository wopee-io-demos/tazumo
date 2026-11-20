import assert from 'node:assert/strict';
import test from 'node:test';
import { FixtureGeocoder, fixtureAddresses, fixtureMerchantZone, resolveAddressDelivery, type Geocoder } from './index.ts';

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
  const inside = await resolveAddressDelivery(geocoder, 'SK', fixtureAddresses.skInside.address, [fixtureMerchantZone]);
  assert.equal(inside.status, 'found');
  assert.ok(inside.status === 'found' && inside.delivery.deliverable && inside.delivery.distanceMeters < 1_000);
  assert.deepEqual(await resolveAddressDelivery(geocoder, 'SK', fixtureAddresses.skOutside.address, [fixtureMerchantZone]), {
    status: 'found',
    point: fixtureAddresses.skOutside.point,
    delivery: { deliverable: false, reason: 'outside_zone' },
  });
  for (const key of ['czInside', 'atInside'] as const) {
    const result = await resolveAddressDelivery(geocoder, fixtureAddresses[key].address.countryCode, fixtureAddresses[key].address, [fixtureMerchantZone]);
    assert.ok(result.status === 'found' && result.delivery.deliverable, key);
  }
  const de = await resolveAddressDelivery(geocoder, 'DE', fixtureAddresses.deOutside.address, [fixtureMerchantZone]);
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

test('invalid addresses never reach the geocoder', async () => {
  let calls = 0;
  const spy: Geocoder = { geocode: async () => (calls++, { status: 'not_found' }) };
  const result = await resolveAddressDelivery(spy, 'DE', { ...fixtureAddresses.deOutside.address, postalCode: '1011' }, [fixtureMerchantZone]);
  assert.deepEqual(result, { status: 'invalid', errors: [{ path: 'postalCode', code: 'invalid_format' }] });
  assert.equal(calls, 0);
  assert.deepEqual(await resolveAddressDelivery(spy, 'DE', fixtureAddresses.deOutside.address, [fixtureMerchantZone]), { status: 'not_found' });
  assert.equal(calls, 1);
});

test('the geocoder hands out copies, so callers cannot corrupt the fixture table', async () => {
  const geocoder = new FixtureGeocoder();
  const first = await geocoder.geocode(fixtureAddresses.skInside.address);
  assert.ok(first.status === 'found');
  first.point.lat = 0;
  assert.deepEqual(await geocoder.geocode(fixtureAddresses.skInside.address), { status: 'found', point: fixtureAddresses.skInside.point, precision: 'address' });
});
