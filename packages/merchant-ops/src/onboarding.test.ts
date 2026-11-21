import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  allowedCommands,
  emailPattern,
  onboardingStates,
  roles,
  transitionOnboarding,
  validateStoreProfile,
  type Principal,
  type MerchantOnboarding,
  type OnboardingCommand,
  type StoreProfile,
} from './index.ts';

const merchantId = '7d1c3f0e-0000-4000-8000-000000000001';
const profile: StoreProfile = {
  name: 'Synthetic Corner Shop',
  slug: 'synthetic-corner-shop',
  marketCode: 'sk-bratislava',
  address: { line1: 'Example Street 1', city: 'Bratislava', postalCode: '811 01', countryCode: 'SK' },
  contact: { email: 'shop@example.test', phone: '+421900000000' },
  legalEntity: { registeredName: 'Synthetic Corner Shop s.r.o.', registrationNumber: '00000000', vatId: 'SK0000000000' },
};
const draft: MerchantOnboarding = { merchantId, state: 'draft', profile, updatedAt: '2026-11-01T08:00:00.000Z' };

const customerGrant = { role: 'customer', merchantId: null } as const;
const staff: Principal = { userId: 'u-staff', grants: [customerGrant, { role: 'merchant_staff', merchantId }] };
const otherStaff: Principal = { userId: 'u-other', grants: [{ role: 'merchant_staff', merchantId: '7d1c3f0e-0000-4000-8000-000000000002' }] };
const support: Principal = { userId: 'u-support', grants: [customerGrant, { role: 'support', merchantId: null }] };
const admin: Principal = { userId: 'u-admin', grants: [{ role: 'admin', merchantId: null }] };
const customer: Principal = { userId: 'u-customer', grants: [customerGrant] };
const courier: Principal = { userId: 'u-courier', grants: [{ role: 'courier', merchantId: null }] };
const at = '2026-11-20T10:00:00Z';

function run(start: MerchantOnboarding, steps: [OnboardingCommand, Principal, string?][]) {
  let merchant = start;
  const audit = [];
  for (const [command, actor, reason] of steps) {
    const result = transitionOnboarding(merchant, command, actor, at, reason);
    assert.ok(result.ok, `${command} by ${actor.userId} from ${merchant.state}: ${!result.ok && result.error}`);
    merchant = result.value;
    audit.push(result.audit);
  }
  return { merchant, audit };
}

test('happy path draft to live, suspension and reinstatement, one audit entry per transition', () => {
  const { merchant, audit } = run(draft, [
    ['submit', staff],
    ['start_review', support],
    ['approve', admin],
    ['go_live', staff],
    ['suspend', support, 'Synthetic compliance hold'],
    ['reinstate', admin],
  ]);
  assert.equal(merchant.state, 'live');
  assert.equal(merchant.updatedAt, '2026-11-20T10:00:00.000Z');
  assert.deepEqual(
    audit.map((a) => [a.action, a.actorUserId, a.details.actorRole, a.details.from, a.details.to]),
    [
      ['merchant_onboarding:submit', 'u-staff', 'merchant_staff', 'draft', 'submitted'],
      ['merchant_onboarding:start_review', 'u-support', 'support', 'submitted', 'in_review'],
      ['merchant_onboarding:approve', 'u-admin', 'admin', 'in_review', 'approved'],
      ['merchant_onboarding:go_live', 'u-staff', 'merchant_staff', 'approved', 'live'],
      ['merchant_onboarding:suspend', 'u-support', 'support', 'live', 'suspended'],
      ['merchant_onboarding:reinstate', 'u-admin', 'admin', 'suspended', 'live'],
    ],
  );
  assert.equal(audit[4].details.reason, 'Synthetic compliance hold');
  assert.ok(audit.every((a) => a.resourceType === 'merchant' && a.resourceId === merchantId));
  assert.equal(draft.state, 'draft');
});

test('rejection carries a reason and the merchant can revise and resubmit', () => {
  const { merchant, audit } = run(draft, [
    ['submit', staff],
    ['start_review', admin],
    ['reject', support, '  Legal entity number missing  '],
    ['revise', staff],
    ['submit', staff],
  ]);
  assert.equal(merchant.state, 'submitted');
  assert.equal(audit[2].details.reason, 'Legal entity number missing');
});

test('illegal transitions are refused without an audit entry', () => {
  const cases: [MerchantOnboarding['state'], OnboardingCommand, Principal][] = [
    ['draft', 'approve', admin],
    ['draft', 'go_live', admin],
    ['submitted', 'approve', support],
    ['approved', 'submit', staff],
    ['rejected', 'go_live', staff],
    ['live', 'submit', staff],
    ['suspended', 'go_live', admin],
  ];
  for (const [state, command, actor] of cases) {
    const result = transitionOnboarding({ ...draft, state }, command, actor, at, 'reason');
    assert.deepEqual(result, { ok: false, error: 'illegal_transition' }, `${command} from ${state}`);
  }
  assert.deepEqual(transitionOnboarding(draft, 'constructor' as OnboardingCommand, admin, at), { ok: false, error: 'illegal_transition' });
});

test('roles outside the transition rule, and staff of another merchant, are forbidden', () => {
  const cases: [MerchantOnboarding['state'], OnboardingCommand, Principal][] = [
    ['draft', 'submit', customer],
    ['draft', 'submit', courier],
    ['draft', 'submit', otherStaff],
    ['draft', 'submit', { userId: 'u-x', grants: [] }],
    ['draft', 'submit', { userId: 'u-y' } as Principal],
    ['draft', 'submit', support],
    ['submitted', 'start_review', staff],
    ['in_review', 'approve', staff],
    ['in_review', 'reject', customer],
    ['approved', 'go_live', support],
    ['approved', 'go_live', otherStaff],
    ['live', 'suspend', staff],
    ['suspended', 'reinstate', support],
    ['rejected', 'revise', admin],
  ];
  for (const [state, command, actor] of cases) {
    const result = transitionOnboarding({ ...draft, state }, command, actor, at, 'reason');
    assert.deepEqual(result, { ok: false, error: 'forbidden' }, `${command} by ${actor.userId} from ${state}`);
  }
});

test('reject and suspend require a non-blank reason; submit requires a valid profile', () => {
  for (const [state, command] of [['in_review', 'reject'], ['live', 'suspend']] as const) {
    for (const reason of [undefined, '', '   ']) {
      assert.deepEqual(transitionOnboarding({ ...draft, state }, command, admin, at, reason), { ok: false, error: 'reason_required' });
    }
  }
  const invalid = transitionOnboarding({ ...draft, profile: { ...profile, slug: 'Bad Slug' } }, 'submit', staff, at);
  assert.equal(invalid.ok, false);
  assert.deepEqual(!invalid.ok && [invalid.error, invalid.fieldErrors], ['invalid_profile', [{ path: 'slug', code: 'invalid_format' }]]);
  assert.deepEqual(transitionOnboarding(draft, 'submit', staff, 'not a date'), { ok: false, error: 'invalid_instant' });
});

test('each state lists its explicit next commands', () => {
  assert.deepEqual(
    Object.fromEntries(onboardingStates.map((s) => [s, allowedCommands(s)])),
    {
      draft: ['submit'],
      submitted: ['start_review'],
      in_review: ['approve', 'reject'],
      approved: ['go_live'],
      rejected: ['revise'],
      live: ['suspend'],
      suspended: ['reinstate'],
    },
  );
});

test('store profile validation reports each invalid field by path', () => {
  assert.deepEqual(validateStoreProfile(profile), []);
  assert.deepEqual(validateStoreProfile({ ...profile, legalEntity: { ...profile.legalEntity, vatId: undefined } }), []);
  const broken: StoreProfile = {
    name: '   ',
    slug: 'UPPER',
    marketCode: '',
    address: { line1: 'x'.repeat(201), city: 'Berlin', postalCode: '!', countryCode: 'de' },
    contact: { email: 'not-an-email', phone: '0900 000 000' },
    legalEntity: { registeredName: 'Synthetic GmbH', registrationNumber: 'HRB 0000', vatId: '123' },
  };
  assert.deepEqual(validateStoreProfile(broken), [
    { path: 'name', code: 'required' },
    { path: 'slug', code: 'invalid_format' },
    { path: 'marketCode', code: 'required' },
    { path: 'address.line1', code: 'too_long' },
    { path: 'address.postalCode', code: 'invalid_format' },
    { path: 'address.countryCode', code: 'invalid_format' },
    { path: 'contact.email', code: 'invalid_format' },
    { path: 'contact.phone', code: 'invalid_format' },
    { path: 'legalEntity.vatId', code: 'invalid_format' },
  ]);
  assert.deepEqual(validateStoreProfile({ ...profile, name: 'n'.repeat(201) }), [{ path: 'name', code: 'too_long' }]);
});

test('a principal with several grants is matched by the rule and the matched role is audited', () => {
  const both: Principal = { userId: 'u-both', grants: [{ role: 'support', merchantId: null }, { role: 'merchant_staff', merchantId }] };
  const submitted = transitionOnboarding(draft, 'submit', both, at);
  assert.ok(submitted.ok);
  assert.equal(submitted.audit.details.actorRole, 'merchant_staff');
  const review = transitionOnboarding(submitted.value, 'start_review', both, at);
  assert.ok(review.ok);
  assert.equal(review.audit.details.actorRole, 'support');
});

test('reasons must be strings of at most 500 characters', () => {
  const inReview = { ...draft, state: 'in_review' } as const;
  assert.deepEqual(transitionOnboarding(inReview, 'reject', admin, at, 42 as unknown as string), { ok: false, error: 'reason_required' });
  assert.deepEqual(transitionOnboarding(inReview, 'reject', admin, at, 'r'.repeat(501)), { ok: false, error: 'reason_too_long' });
  assert.ok(transitionOnboarding(inReview, 'reject', admin, at, 'r'.repeat(500)).ok);
  assert.deepEqual(transitionOnboarding(draft, 'submit', staff, '2026-11-20T10:00:00'), { ok: false, error: 'invalid_instant' });
});

test('profile lengths count raw characters like the merchants CHECK, and non-strings are rejected', () => {
  assert.deepEqual(validateStoreProfile({ ...profile, name: ` ${'n'.repeat(199)} ` }), [{ path: 'name', code: 'too_long' }]);
  assert.deepEqual(validateStoreProfile({ ...profile, slug: 7 as unknown as string }), [{ path: 'slug', code: 'invalid_format' }]);
  assert.equal(validateStoreProfile({} as StoreProfile).length, 11);
});

test('e-mail validation is linear on the CodeQL polynomial-ReDoS input and rejects it', () => {
  const alert = '!@!.' + '!.'.repeat(50_000);
  for (const input of [alert, `${alert} `, `${alert}@`]) {
    const started = performance.now();
    assert.equal(emailPattern.test(input), false);
    assert.ok(performance.now() - started < 100, 'regex must not backtrack');
  }
  const started = performance.now();
  assert.deepEqual(validateStoreProfile({ ...profile, contact: { ...profile.contact, email: alert } }), [{ path: 'contact.email', code: 'too_long' }]);
  assert.ok(performance.now() - started < 100);
  for (const valid of ['shop@example.test', 'first.last@sub.example.co']) assert.equal(emailPattern.test(valid), true, valid);
  for (const invalid of ['x@y', 'a@b.', 'a@.b', 'a@b..c', 'a b@c.d', 'a@b@c.d']) assert.equal(emailPattern.test(invalid), false, invalid);
});

test('role names match apps/api policy and the user_roles CHECK constraint', () => {
  const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const list = (source: string, pattern: RegExp) => [...(source.match(pattern)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(list(read('apps/api/src/auth/policy.ts'), /roles = \[([^\]]+)\]/), [...roles]);
  assert.deepEqual(list(read('apps/api/migrations/0002_identity-and-roles.sql'), /role IN \(([^)]+)\)/), [...roles]);
});
