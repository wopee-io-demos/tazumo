import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkDelivery,
  checkOrderable,
  distanceMeters,
  expireIfDue,
  isAvailableAt,
  openAcceptanceWindow,
  respondToOrder,
  validateAvailability,
  validateDeliveryZone,
  type Actor,
  type OpeningHours,
} from './index.ts';

const bratislava = { lat: 48.1486, lng: 17.1077 };
const vienna = { lat: 48.2082, lng: 16.3738 };

test('haversine distance matches reference values', () => {
  assert.equal(distanceMeters(bratislava, bratislava), 0);
  assert.ok(Math.abs(distanceMeters(bratislava, vienna) - 54_818) < 5);
  assert.ok(Math.abs(distanceMeters({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }) - 22_239) < 5);
  assert.throws(() => distanceMeters({ lat: 91, lng: 0 }, bratislava), RangeError);
});

test('delivery zone check is inclusive at the radius, picks the nearest zone and skips invalid zones', () => {
  const d = distanceMeters(bratislava, vienna);
  assert.deepEqual(checkDelivery([{ center: bratislava, radiusMeters: 5_000 }], vienna), { deliverable: false, reason: 'outside_zone' });
  assert.deepEqual(checkDelivery([{ center: vienna, radiusMeters: 50_000 }, { center: bratislava, radiusMeters: 50_000 }], bratislava), {
    deliverable: true,
    distanceMeters: 0,
  });
  const boundary = { lat: 48.1486, lng: 17.2 };
  const exact = distanceMeters(bratislava, boundary);
  assert.equal(checkDelivery([{ center: bratislava, radiusMeters: exact }], boundary).deliverable, true);
  assert.equal(checkDelivery([{ center: bratislava, radiusMeters: exact - 0.01 }], boundary).deliverable, false);
  assert.deepEqual(checkDelivery([{ center: bratislava, radiusMeters: d }], vienna), { deliverable: false, reason: 'outside_zone' });
  assert.deepEqual(checkDelivery([{ center: bratislava, radiusMeters: 5_000 }], { lat: 0, lng: 200 }), { deliverable: false, reason: 'invalid_destination' });
  assert.deepEqual(checkDelivery([], bratislava), { deliverable: false, reason: 'outside_zone' });
  assert.deepEqual(validateDeliveryZone({ center: { lat: Number.NaN, lng: 0 }, radiusMeters: 0 }), ['center', 'radiusMeters']);
  assert.deepEqual(validateDeliveryZone({ center: bratislava, radiusMeters: 50_001 }), ['radiusMeters']);
});

test('inventory availability: in stock, out of stock and scheduled windows', () => {
  const window = { status: 'scheduled', from: '2026-11-20T10:00:00Z', until: '2026-11-20T14:00:00Z' } as const;
  assert.equal(isAvailableAt({ status: 'in_stock' }, '2026-11-20T09:00:00Z'), true);
  assert.equal(isAvailableAt({ status: 'out_of_stock' }, '2026-11-20T09:00:00Z'), false);
  assert.equal(isAvailableAt(window, '2026-11-20T09:59:59Z'), false);
  assert.equal(isAvailableAt(window, '2026-11-20T10:00:00Z'), true);
  assert.equal(isAvailableAt(window, '2026-11-20T14:00:00Z'), false);
  assert.equal(isAvailableAt({ status: 'scheduled', from: '2026-11-20T10:00:00Z' }, '2027-01-01T00:00:00Z'), true);
  assert.deepEqual(validateAvailability({ status: 'scheduled', from: '2026-11-20T10:00:00Z', until: '2026-11-20T10:00:00Z' }), ['until']);
  assert.deepEqual(validateAvailability({ status: 'scheduled', from: 'soon' }), ['from']);
  assert.equal(isAvailableAt({ status: 'scheduled', from: 'soon' }, '2026-11-20T10:00:00Z'), false);
});

test('an item is orderable only when the merchant is live, open and the item available', () => {
  const hours: OpeningHours = { timeZone: 'Europe/Bratislava', weekly: { fri: [{ open: '08:00', close: '20:00' }] } };
  const at = '2026-11-20T10:00:00Z';
  const input = { onboardingState: 'live', hours, availability: { status: 'in_stock' } } as const;
  assert.deepEqual(checkOrderable(input, at), { ok: true });
  assert.deepEqual(checkOrderable({ ...input, onboardingState: 'suspended' }, at), { ok: false, reason: 'merchant_not_live' });
  assert.deepEqual(checkOrderable({ ...input, onboardingState: 'approved' }, at), { ok: false, reason: 'merchant_not_live' });
  assert.deepEqual(checkOrderable(input, '2026-11-20T19:00:00Z'), { ok: false, reason: 'merchant_closed' });
  assert.deepEqual(checkOrderable({ ...input, availability: { status: 'out_of_stock' } }, at), { ok: false, reason: 'item_unavailable' });
});

const merchantId = '7d1c3f0e-0000-4000-8000-000000000001';
const staff: Actor = { userId: 'u-staff', role: 'merchant_staff', merchantId };
const pending = openAcceptanceWindow('order-1', merchantId, '2026-11-20T10:00:00Z', 5);

test('acceptance window: accept or decline before the deadline, audited', () => {
  assert.equal(pending.deadline, '2026-11-20T10:05:00.000Z');
  const accepted = respondToOrder(pending, 'accept', staff, '2026-11-20T10:04:59Z');
  assert.ok(accepted.ok);
  assert.equal(accepted.value.state, 'accepted');
  assert.deepEqual(accepted.audit, {
    actorUserId: 'u-staff',
    action: 'merchant_order:accept',
    resourceType: 'merchant_order',
    resourceId: 'order-1',
    occurredAt: '2026-11-20T10:04:59.000Z',
    details: { merchantId, actorRole: 'merchant_staff' },
  });
  const declined = respondToOrder(pending, 'decline', staff, '2026-11-20T10:01:00Z', 'too_busy');
  assert.ok(declined.ok);
  assert.deepEqual([declined.value.state, declined.value.declineReason, declined.audit.details.reason], ['declined', 'too_busy', 'too_busy']);
  assert.equal(pending.state, 'pending');
});

test('acceptance window: refusals for wrong actor, missing reason, late or repeated responses', () => {
  const at = '2026-11-20T10:01:00Z';
  const other: Actor = { userId: 'u-other', role: 'merchant_staff', merchantId: '7d1c3f0e-0000-4000-8000-000000000002' };
  for (const actor of [other, { userId: 'u-admin', role: 'admin' }, { userId: 'u-c', role: 'customer' }] as Actor[]) {
    assert.deepEqual(respondToOrder(pending, 'accept', actor, at), { ok: false, error: 'forbidden' });
  }
  assert.deepEqual(respondToOrder(pending, 'decline', staff, at), { ok: false, error: 'reason_required' });
  assert.deepEqual(respondToOrder(pending, 'decline', staff, at, 'nope' as never), { ok: false, error: 'reason_required' });
  assert.deepEqual(respondToOrder(pending, 'accept', staff, '2026-11-20T10:05:00Z'), { ok: false, error: 'window_expired' });
  assert.deepEqual(respondToOrder(pending, 'accept', staff, 'later'), { ok: false, error: 'invalid_instant' });
  const accepted = respondToOrder(pending, 'accept', staff, at);
  assert.ok(accepted.ok);
  assert.deepEqual(respondToOrder(accepted.value, 'decline', staff, at, 'other'), { ok: false, error: 'already_decided' });
  assert.deepEqual(expireIfDue(accepted.value, '2026-11-20T11:00:00Z'), { ok: false, error: 'already_decided' });
});

test('acceptance window: auto-decline at the deadline by the system actor', () => {
  assert.deepEqual(expireIfDue(pending, '2026-11-20T10:04:59Z'), { ok: false, error: 'not_due' });
  const expired = expireIfDue(pending, '2026-11-20T10:07:30Z');
  assert.ok(expired.ok);
  assert.deepEqual([expired.value.state, expired.value.decidedAt, expired.value.declineReason], ['auto_declined', pending.deadline, 'window_expired']);
  assert.deepEqual([expired.audit.actorUserId, expired.audit.action, expired.audit.details.actorRole], [null, 'merchant_order:auto_decline', 'system']);
});

test('acceptance window length is bounded', () => {
  for (const minutes of [0, 31, 1.5, Number.NaN]) {
    assert.throws(() => openAcceptanceWindow('o', merchantId, '2026-11-20T10:00:00Z', minutes), RangeError);
  }
  assert.throws(() => openAcceptanceWindow('o', merchantId, 'bad', 5), RangeError);
  assert.equal(openAcceptanceWindow('o', merchantId, '2026-11-20T10:00:00Z', 30).deadline, '2026-11-20T10:30:00.000Z');
});
