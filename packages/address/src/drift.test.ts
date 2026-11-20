import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { addressFields, addressMarkets, addressMaxLength, checkDelivery, earthRadiusMeters, maxRadiusMeters, requiredAddressFields } from './index.ts';

const sibling = (path: string) => new URL(`../../${path}`, import.meta.url);
const merchantOps = sibling('merchant-ops/src/index.ts');
const commerce = sibling('commerce/src/index.ts');

test('fields, required set and length limits match DeliveryAddress in contracts/openapi.json', () => {
  const contract = JSON.parse(readFileSync(new URL('../../../contracts/openapi.json', import.meta.url), 'utf8'));
  const schema = contract.components.schemas.DeliveryAddress;
  assert.deepEqual(Object.keys(schema.properties).sort(), [...addressFields].sort());
  assert.deepEqual([...schema.required].sort(), [...requiredAddressFields].sort());
  assert.equal(schema.additionalProperties, false);
  for (const [field, property] of Object.entries<{ maxLength?: number }>(schema.properties)) {
    if (property.maxLength !== undefined) assert.equal(addressMaxLength[field as keyof typeof addressMaxLength], property.maxLength, field);
  }
});

test('zone semantics match @tazumo/merchant-ops checkDelivery', { skip: !existsSync(merchantOps) && '@tazumo/merchant-ops is not on main yet (PR #76)' }, async () => {
  const ops = await import(merchantOps.href);
  assert.equal(ops.earthRadiusMeters, earthRadiusMeters);
  assert.equal(ops.maxRadiusMeters, maxRadiusMeters);
  const center = { lat: 48.1486, lng: 17.1077 };
  const zones = [
    [{ center, radiusMeters: 5_000 }],
    [{ center, radiusMeters: 50_000 }, { center: { lat: 48.2, lng: 17.2 }, radiusMeters: 1_000 }],
    [{ center, radiusMeters: 50_001 }],
    [{ center: { lat: 91, lng: 0 }, radiusMeters: 1_000 }],
    [],
  ];
  const destinations = [center, { lat: 48.1512, lng: 17.1123 }, { lat: 48.3736, lng: 17.1077 }, { lat: 48.2, lng: 17.2 }, { lat: 95, lng: 0 }, { lat: Number.NaN, lng: 0 }];
  for (const zoneSet of zones) for (const destination of destinations) assert.deepEqual(checkDelivery(zoneSet, destination), ops.checkDelivery(zoneSet, destination));
});

test('markets match @tazumo/commerce marketCodes', { skip: !existsSync(commerce) && '@tazumo/commerce is not on main yet (issue #11, PR #80)' }, async () => {
  const { marketCodes } = await import(commerce.href);
  assert.deepEqual([...addressMarkets].sort(), [...marketCodes].sort());
});
