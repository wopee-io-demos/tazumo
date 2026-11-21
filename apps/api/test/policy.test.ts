import test from 'node:test';
import assert from 'node:assert/strict';
import { can, type Principal } from '../src/auth/policy.ts';

const merchantA = '00000000-0000-4000-8000-00000000000a';
const merchantB = '00000000-0000-4000-8000-00000000000b';
const principal = (userId: string, ...grants: Principal['grants']): Principal => ({ userId, grants });
const customer = principal('u-customer', { role: 'customer', merchantId: null });
const staffA = principal('u-staff', { role: 'customer', merchantId: null }, { role: 'merchant_staff', merchantId: merchantA });
const support = principal('u-support', { role: 'support', merchantId: null });
const admin = principal('u-admin', { role: 'admin', merchantId: null });
const merchant = (id: string, exists = true) => ({ type: 'merchant' as const, id, exists });

test('users read themselves; support and admin reads are audited', () => {
  assert.deepEqual(can(customer, 'user:read', { type: 'user', id: 'u-customer' }), { allowed: true, audit: false });
  assert.deepEqual(can(support, 'user:read', { type: 'user', id: 'u-customer' }), { allowed: true, audit: true });
  assert.deepEqual(can(admin, 'user:read', { type: 'user', id: 'u-customer' }), { allowed: true, audit: true });
});

test('cross-tenant reads are denied: 404 for customers, 403 for staff', () => {
  assert.deepEqual(can(customer, 'user:read', { type: 'user', id: 'u-staff' }), { allowed: false, status: 404 });
  assert.deepEqual(can(staffA, 'user:read', { type: 'user', id: 'u-customer' }), { allowed: false, status: 403 });
  assert.deepEqual(can(customer, 'merchant_staff:list', merchant(merchantA)), { allowed: false, status: 404 });
  assert.deepEqual(can(staffA, 'merchant_staff:list', merchant(merchantB)), { allowed: false, status: 403 });
});

test('merchant staff are scoped to their merchant', () => {
  assert.deepEqual(can(staffA, 'merchant_staff:list', merchant(merchantA)), { allowed: true, audit: false });
  assert.deepEqual(can(support, 'merchant_staff:list', merchant(merchantB)), { allowed: true, audit: true });
});

test('couriers are not staff for disclosure purposes', () => {
  const courier = principal('u-courier', { role: 'courier', merchantId: null });
  assert.deepEqual(can(courier, 'merchant_staff:list', merchant(merchantA)), { allowed: false, status: 404 });
  assert.deepEqual(can(courier, 'user:read', { type: 'user', id: 'u-customer' }), { allowed: false, status: 404 });
});

test('unknown resources are 404 for everyone', () => {
  for (const p of [customer, staffA, support, admin]) {
    assert.deepEqual(can(p, 'merchant_staff:list', merchant(merchantB, false)), { allowed: false, status: 404 });
  }
});

test('a principal without grants gets nothing beyond itself', () => {
  const bare = principal('u-bare');
  assert.deepEqual(can(bare, 'merchant_staff:list', merchant(merchantA)), { allowed: false, status: 404 });
  assert.deepEqual(can(bare, 'user:read', { type: 'user', id: 'u-bare' }), { allowed: true, audit: false });
});

test('only admins manage roles, and never their own', () => {
  const target = { type: 'user' as const, id: 'u-customer' };
  assert.deepEqual(can(admin, 'role:manage', target), { allowed: true, audit: true });
  for (const p of [customer, staffA, support]) assert.deepEqual(can(p, 'role:manage', target), { allowed: false, status: 403 });
  assert.deepEqual(can(admin, 'role:manage', { type: 'user', id: 'u-admin' }), { allowed: false, status: 403 });
  assert.deepEqual(can(support, 'role:manage', { type: 'user', id: 'u-support' }), { allowed: false, status: 403 });
});

test('erasure: self, support and admin may erase; others get 403', () => {
  assert.deepEqual(can(customer, 'user:erase', { type: 'user', id: 'u-customer' }), { allowed: true, audit: true });
  assert.deepEqual(can(support, 'user:erase', { type: 'user', id: 'u-customer' }), { allowed: true, audit: true });
  assert.deepEqual(can(admin, 'user:erase', { type: 'user', id: 'u-customer' }), { allowed: true, audit: true });
  assert.deepEqual(can(customer, 'user:erase', { type: 'user', id: 'u-staff' }), { allowed: false, status: 403 });
  assert.deepEqual(can(staffA, 'user:erase', { type: 'user', id: 'u-customer' }), { allowed: false, status: 403 });
});
