import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  applyCommand,
  createOrder,
  customerTimeline,
  replay,
  type AcceptanceDecision,
  type Actor,
  type Command,
  type CommandType,
  type OrderEvent,
  type OrderStatus,
  type Principal,
  terminalStatuses,
} from './index.ts';

const ORDER = '0b6f1d5e-3a7c-4c51-9d0e-2f6a8b1c4d01';
const OTHER_ORDER = '0b6f1d5e-3a7c-4c51-9d0e-2f6a8b1c4d02';
const MERCHANT = '6a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a01';
const OTHER_MERCHANT = '6a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a02';
const CUSTOMER_ID = 'a1000000-0000-4000-8000-000000000001';
const OTHER_CUSTOMER_ID = 'a1000000-0000-4000-8000-000000000002';
const STAFF_ID = 'a1000000-0000-4000-8000-000000000003';
const OTHER_STAFF_ID = 'a1000000-0000-4000-8000-000000000004';
const SUPPORT_ID = 'a1000000-0000-4000-8000-000000000005';
const OTHER_SUPPORT_ID = 'a1000000-0000-4000-8000-000000000006';
const ADMIN_ID = 'a1000000-0000-4000-8000-000000000007';
const STRAY_ID = 'a1000000-0000-4000-8000-000000000008';
const COURIER_ID = 'c0c0c0c0-1111-4222-8333-444455556666';

const user = (userId: string, ...grants: Principal['grants']): Actor => ({ kind: 'user', principal: { userId, grants } });
const customer = user(CUSTOMER_ID, { role: 'customer', merchantId: null });
const otherCustomer = user(OTHER_CUSTOMER_ID, { role: 'customer', merchantId: null });
const staff = user(STAFF_ID, { role: 'customer', merchantId: null }, { role: 'merchant_staff', merchantId: MERCHANT });
const otherStaff = user(OTHER_STAFF_ID, { role: 'merchant_staff', merchantId: OTHER_MERCHANT });
const courier = user(COURIER_ID, { role: 'courier', merchantId: null });
const otherCourier = user('c0c0c0c0-1111-4222-8333-444455557777', { role: 'courier', merchantId: null });
const support = user(SUPPORT_ID, { role: 'support', merchantId: null });
const admin = user(ADMIN_ID, { role: 'admin', merchantId: null });
const system = (source: 'payment' | 'acceptance' | 'dispatch' | 'operations'): Actor => ({ kind: 'system', source });

let ids = 0;
const options = { newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}` };
const minute = (n: number) => new Date(Date.UTC(2026, 10, 20, 12, n)).toISOString();

const acceptance = (state: AcceptanceDecision['state'], extra: Partial<AcceptanceDecision> = {}): AcceptanceDecision => ({
  orderId: ORDER,
  merchantId: MERCHANT,
  state,
  receivedAt: minute(2),
  deadline: minute(12),
  decidedAt: minute(3),
  ...(state === 'declined' ? { declineReason: 'too_busy' } : {}),
  ...(state === 'auto_declined' ? { declineReason: 'window_expired', decidedAt: minute(12) } : {}),
  ...extra,
});

const happySteps: [Command, Actor][] = [
  [{ type: 'request_payment' }, system('payment')],
  [{ type: 'payment_authorized', paymentReference: 'pi_test_123' }, system('payment')],
  [{ type: 'merchant_accept', acceptance: acceptance('accepted') }, staff],
  [{ type: 'start_preparing' }, staff],
  [{ type: 'mark_ready' }, staff],
  [{ type: 'assign_courier', courierUserId: COURIER_ID }, system('dispatch')],
  [{ type: 'pick_up' }, courier],
  [{ type: 'deliver' }, courier],
];

function created(): OrderEvent[] {
  const r = createOrder({ orderId: ORDER, merchantId: MERCHANT, total: { currency: 'EUR', minorUnits: 2380 } }, customer, minute(0), 'create-key-1', options);
  assert.ok(r.ok, JSON.stringify(r));
  return [r.value.event];
}

function run(events: OrderEvent[], steps: [Command, Actor][], start = events.length): OrderEvent[] {
  const log = [...events];
  steps.forEach(([command, actor], i) => {
    const r = applyCommand(log, command, actor, minute(start + i), `key-${start + i}-${command.type}`, options);
    assert.ok(r.ok, `${command.type}: ${JSON.stringify(r)}`);
    log.push(r.value.event);
  });
  return log;
}

type Situation = 'created' | 'payment_pending' | 'confirmed' | 'confirmed_accepted' | 'preparing' | 'ready_for_pickup' | 'courier_assigned' | 'picked_up' | 'delivered' | 'cancelled' | 'failed';
function reach(situation: Situation): OrderEvent[] {
  const order: Situation[] = ['created', 'payment_pending', 'confirmed', 'confirmed_accepted', 'preparing', 'ready_for_pickup', 'courier_assigned', 'picked_up', 'delivered'];
  if (situation === 'cancelled') return run(created(), [[{ type: 'cancel' }, customer]]);
  if (situation === 'failed') return run(created(), [[{ type: 'fail', reason: 'internal_error' }, system('operations')]]);
  return run(created(), happySteps.slice(0, order.indexOf(situation)));
}

describe('order lifecycle', () => {
  it('runs the happy path from created to delivered with sequenced, attributed events', () => {
    const log = run(created(), happySteps);
    assert.deepEqual(log.map((e) => e.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(log.map((e) => e.status), ['created', 'payment_pending', 'confirmed', 'confirmed', 'preparing', 'ready_for_pickup', 'courier_assigned', 'picked_up', 'delivered']);
    assert.ok(log.every((e, i) => i === 0 || e.occurredAt >= log[i - 1].occurredAt));
    assert.deepEqual(log[3].actor, { kind: 'user', userId: STAFF_ID, role: 'merchant_staff', merchantId: MERCHANT });
    assert.deepEqual(log[2].actor, { kind: 'system', source: 'payment' });
    const state = replay(log);
    assert.ok(state.ok);
    assert.equal(state.value.status, 'delivered');
    assert.equal(state.value.courierUserId, COURIER_ID);
    assert.equal(state.value.paymentReference, 'pi_test_123');
    assert.deepEqual(state.value.total, { currency: 'EUR', minorUnits: 2380 });
  });

  it('returns the original event for a repeated command with the same idempotency key', () => {
    const log = reach('payment_pending');
    const command: Command = { type: 'payment_authorized', paymentReference: 'pi_test_123' };
    const first = applyCommand(log, command, system('payment'), minute(5), 'webhook-evt-0001', options);
    assert.ok(first.ok);
    const withFirst = [...log, first.value.event];
    const again = applyCommand(withFirst, command, system('payment'), minute(9), 'webhook-evt-0001', options);
    assert.ok(again.ok);
    assert.equal(again.value.replayed, true);
    assert.equal(again.value.event, first.value.event);
    assert.equal(again.value.state.sequence, withFirst.length);
  });

  it('rejects a reused idempotency key with another command, payload or actor', () => {
    const log = run(reach('payment_pending'), [[{ type: 'payment_authorized', paymentReference: 'pi_a' }, system('payment')]]);
    const key = log.at(-1)!.idempotencyKey;
    for (const [command, actor] of [
      [{ type: 'payment_authorized', paymentReference: 'pi_b' }, system('payment')],
      [{ type: 'fail', reason: 'internal_error' }, system('operations')],
    ] as [Command, Actor][]) {
      const r = applyCommand(log, command, actor, minute(30), key, options);
      assert.equal(r.ok ? 'ok' : r.error, 'idempotency_conflict');
    }
    const cancelled = run(reach('preparing'), [[{ type: 'cancel', reason: 'merchant_unreachable' }, support]]);
    const otherSupport = user(OTHER_SUPPORT_ID, { role: 'support', merchantId: null });
    const byOther = applyCommand(cancelled, { type: 'cancel', reason: 'merchant_unreachable' }, otherSupport, minute(50), cancelled.at(-1)!.idempotencyKey, options);
    assert.equal(byOther.ok ? 'ok' : byOther.error, 'idempotency_conflict');
  });

  it('authorizes before the idempotency lookup, so revoked or unrelated actors learn nothing', () => {
    const log = run(reach('preparing'), [[{ type: 'cancel', reason: 'merchant_unreachable' }, support]]);
    const key = log.at(-1)!.idempotencyKey;
    const revoked = applyCommand(log, { type: 'cancel', reason: 'merchant_unreachable' }, user(SUPPORT_ID), minute(50), key, options);
    assert.equal(revoked.ok ? 'ok' : revoked.error, 'forbidden');
    const stranger = applyCommand(log, { type: 'cancel' }, otherCustomer, minute(50), key, options);
    assert.equal(stranger.ok ? 'ok' : stranger.error, 'forbidden');
    const wrongSource = applyCommand(log, { type: 'cancel', reason: 'merchant_unreachable' }, system('operations'), minute(50), key, options);
    assert.equal(wrongSource.ok ? 'ok' : wrongSource.error, 'forbidden');
  });

  it('keeps free text and unknown fields out of events', () => {
    const total = { currency: 'EUR', minorUnits: 100 };
    const note = createOrder({ orderId: ORDER, merchantId: MERCHANT, total, note: 'John Smith, 5 Main St' } as never, customer, minute(0), 'create-key-9', options);
    assert.equal(note.ok ? 'ok' : note.error, 'invalid_input');
    const extraMoney = createOrder({ orderId: ORDER, merchantId: MERCHANT, total: { ...total, memo: 'x' } as never }, customer, minute(0), 'create-key-9', options);
    assert.equal(extraMoney.ok ? 'ok' : extraMoney.error, 'invalid_input');
    const comment = applyCommand(reach('confirmed'), { type: 'merchant_accept', acceptance: { ...acceptance('accepted'), comment: 'Jane Doe +421900111222' } as never }, staff, minute(40), 'comment-key', options);
    assert.equal(comment.ok ? 'ok' : comment.error, 'invalid_input');
    const extra = applyCommand(reach('created'), { type: 'request_payment', note: 'call Jane' } as never, system('payment'), minute(40), 'extra-key-1', options);
    assert.equal(extra.ok ? 'ok' : extra.error, 'invalid_input');
    const log = run(reach('picked_up'), [[{ type: 'deliver' }, courier]]);
    assert.doesNotMatch(JSON.stringify(log), /John|Jane|Main St|\+421/);
  });

  const allowedFrom: Record<CommandType, Situation[]> = {
    request_payment: ['created'],
    payment_authorized: ['payment_pending'],
    payment_failed: ['payment_pending'],
    merchant_accept: ['confirmed'],
    merchant_decline: ['confirmed'],
    auto_decline: ['confirmed'],
    start_preparing: ['confirmed_accepted'],
    mark_ready: ['preparing'],
    assign_courier: ['ready_for_pickup'],
    pick_up: ['courier_assigned'],
    deliver: ['picked_up'],
    cancel: ['created', 'payment_pending', 'confirmed', 'confirmed_accepted', 'preparing', 'ready_for_pickup', 'courier_assigned', 'picked_up'],
    fail: ['created', 'payment_pending', 'confirmed', 'confirmed_accepted', 'preparing', 'ready_for_pickup', 'courier_assigned', 'picked_up'],
  };
  const valid: Record<CommandType, [Command, Actor]> = {
    request_payment: [{ type: 'request_payment' }, system('payment')],
    payment_authorized: [{ type: 'payment_authorized', paymentReference: 'pi_x' }, system('payment')],
    payment_failed: [{ type: 'payment_failed', reason: 'card_declined' }, system('payment')],
    merchant_accept: [{ type: 'merchant_accept', acceptance: acceptance('accepted') }, staff],
    merchant_decline: [{ type: 'merchant_decline', acceptance: acceptance('declined') }, staff],
    auto_decline: [{ type: 'auto_decline', acceptance: acceptance('auto_declined') }, system('acceptance')],
    start_preparing: [{ type: 'start_preparing' }, staff],
    mark_ready: [{ type: 'mark_ready' }, staff],
    assign_courier: [{ type: 'assign_courier', courierUserId: COURIER_ID }, support],
    pick_up: [{ type: 'pick_up' }, courier],
    deliver: [{ type: 'deliver' }, courier],
    cancel: [{ type: 'cancel', reason: 'merchant_unreachable' }, support],
    fail: [{ type: 'fail', reason: 'internal_error' }, system('operations')],
  };
  const situations: Situation[] = ['created', 'payment_pending', 'confirmed', 'confirmed_accepted', 'preparing', 'ready_for_pickup', 'courier_assigned', 'picked_up', 'delivered', 'cancelled', 'failed'];

  for (const [type, from] of Object.entries(allowedFrom) as [CommandType, Situation[]][]) {
    it(`allows ${type} only from ${from.join(', ')}`, () => {
      for (const situation of situations) {
        const log = reach(situation);
        const [command, actor] = valid[type];
        const r = applyCommand(log, command, actor, minute(40), `matrix-${type}-${situation}`, options);
        if (from.includes(situation)) assert.ok(r.ok, `${type} from ${situation}: ${JSON.stringify(r)}`);
        else {
          const courierAbsent = (type === 'pick_up' || type === 'deliver') && !['courier_assigned', 'picked_up', 'delivered'].includes(situation);
          assert.equal(r.ok ? 'ok' : r.error, courierAbsent ? 'forbidden' : 'illegal_transition', `${type} from ${situation}`);
        }
      }
    });
  }

  it('refuses the wrong actor with forbidden and no event', () => {
    const cases: [Situation, Command, Actor][] = [
      ['confirmed', valid.merchant_accept[0], customer],
      ['confirmed', valid.merchant_accept[0], otherStaff],
      ['confirmed', valid.merchant_accept[0], system('acceptance')],
      ['confirmed', valid.auto_decline[0], staff],
      ['created', valid.request_payment[0], system('operations')],
      ['payment_pending', valid.payment_authorized[0], customer],
      ['ready_for_pickup', valid.assign_courier[0], staff],
      ['ready_for_pickup', valid.assign_courier[0], courier],
      ['courier_assigned', valid.pick_up[0], otherCourier],
      ['courier_assigned', valid.pick_up[0], user(COURIER_ID, { role: 'customer', merchantId: null })],
      ['picked_up', valid.deliver[0], support],
      ['created', { type: 'cancel' }, otherCustomer],
      ['created', { type: 'cancel', reason: 'x' }, staff],
      ['created', valid.fail[0], support],
      ['created', valid.fail[0], { kind: 'user', principal: null } as unknown as Actor],
    ];
    for (const [situation, command, actor] of cases) {
      const log = reach(situation);
      const r = applyCommand(log, command, actor, minute(40), 'forbidden-case', options);
      assert.equal(r.ok ? 'ok' : r.error, 'forbidden', `${command.type} by ${JSON.stringify(actor)}`);
    }
  });

  it('lets the customer cancel only before confirmation, and admins act like support', () => {
    assert.ok(applyCommand(reach('payment_pending'), { type: 'cancel' }, customer, minute(40), 'cancel-own-1', options).ok);
    for (const situation of ['confirmed', 'confirmed_accepted'] as Situation[]) {
      const r = applyCommand(reach(situation), { type: 'cancel' }, customer, minute(40), 'cancel-own-3', options);
      assert.equal(r.ok ? 'ok' : r.error, 'illegal_transition', situation);
    }
    const late = applyCommand(reach('preparing'), { type: 'cancel' }, customer, minute(40), 'cancel-own-2', options);
    assert.equal(late.ok ? 'ok' : late.error, 'illegal_transition');
    const byAdmin = applyCommand(reach('preparing'), { type: 'cancel', reason: 'merchant_unreachable' }, admin, minute(40), 'cancel-admin', options);
    assert.ok(byAdmin.ok);
    assert.deepEqual(byAdmin.value.event.actor, { kind: 'user', userId: ADMIN_ID, role: 'admin' });
  });

  it('requires a reason code for system failures, payment failures and support cancellations', () => {
    const cases: [Situation, Command, Actor][] = [
      ['created', { type: 'fail' } as Command, system('operations')],
      ['payment_pending', { type: 'payment_failed', reason: '' }, system('payment')],
      ['preparing', { type: 'cancel' }, support],
      ['preparing', { type: 'cancel', reason: 'Customer called, said John Smith at 5 Main St' }, support],
      ['confirmed', { type: 'merchant_decline', acceptance: acceptance('declined', { declineReason: 'whatever' }) }, staff],
    ];
    for (const [situation, command, actor] of cases) {
      const r = applyCommand(reach(situation), command, actor, minute(40), 'reason-case', options);
      assert.equal(r.ok ? 'ok' : r.error, 'reason_required', JSON.stringify(command));
    }
  });

  it('refuses a decline after the merchant accepted', () => {
    const r = applyCommand(reach('confirmed_accepted'), valid.merchant_decline[0], staff, minute(40), 'late-decline', options);
    assert.equal(r.ok ? 'ok' : r.error, 'illegal_transition');
    const auto = applyCommand(reach('confirmed_accepted'), valid.auto_decline[0], system('acceptance'), minute(40), 'late-auto', options);
    assert.equal(auto.ok ? 'ok' : auto.error, 'illegal_transition');
  });

  it('only consumes a decided acceptance for this order and merchant', () => {
    for (const bad of [
      acceptance('pending', { decidedAt: undefined }),
      acceptance('declined'),
      acceptance('accepted', { orderId: OTHER_ORDER }),
      acceptance('accepted', { merchantId: OTHER_MERCHANT }),
      acceptance('accepted', { decidedAt: 'yesterday' }),
      { ...acceptance('accepted'), state: ['accepted'] } as unknown as AcceptanceDecision,
    ]) {
      const r = applyCommand(reach('confirmed'), { type: 'merchant_accept', acceptance: bad }, staff, minute(40), 'acceptance-case', options);
      assert.equal(r.ok ? 'ok' : r.error, 'acceptance_mismatch', JSON.stringify(bad));
    }
    for (const bad of [
      acceptance('accepted', { decidedAt: minute(12) }),
      acceptance('accepted', { decidedAt: '2020-01-01T00:00:00+05:00', receivedAt: '2020-01-01T00:00:00+05:00' }),
      acceptance('accepted', { decidedAt: '2099-01-01T00:00:00Z', deadline: '2099-01-02T00:00:00Z' }),
      acceptance('accepted', { decidedAt: minute(1) }),
      acceptance('auto_declined', { decidedAt: minute(11) }),
      acceptance('auto_declined', { declineReason: 'too_busy' }),
    ]) {
      const command: Command = bad.state === 'accepted' ? { type: 'merchant_accept', acceptance: bad } : { type: 'auto_decline', acceptance: bad };
      const r = applyCommand(reach('confirmed'), command, bad.state === 'accepted' ? staff : system('acceptance'), minute(40), 'timing-case', options);
      assert.equal(r.ok ? 'ok' : r.error, 'acceptance_mismatch', JSON.stringify(bad));
    }
    const offset = applyCommand(reach('confirmed'), { type: 'merchant_accept', acceptance: acceptance('accepted', { decidedAt: '2026-11-20T13:03:00+01:00' }) }, staff, minute(40), 'offset-key', options);
    assert.ok(offset.ok);
    assert.equal(offset.value.event.data?.acceptanceDecidedAt, minute(3));
    const declined = applyCommand(reach('confirmed'), valid.merchant_decline[0], staff, minute(40), 'decline-ok', options);
    assert.ok(declined.ok);
    assert.equal(declined.value.event.reason, 'too_busy');
    const auto = applyCommand(reach('confirmed'), valid.auto_decline[0], system('acceptance'), minute(40), 'auto-decline-ok', options);
    assert.ok(auto.ok);
    assert.deepEqual([auto.value.state.status, auto.value.event.reason], ['cancelled', 'window_expired']);
  });

  it('validates inputs, keys and instants', () => {
    const total = { currency: 'EUR', minorUnits: 100 };
    const bad: [Parameters<typeof createOrder>, string][] = [
      [[{ orderId: 'nope', merchantId: MERCHANT, total }, customer, minute(0), 'create-key-1'], 'invalid_input'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total: { currency: 'eur', minorUnits: 100 } }, customer, minute(0), 'create-key-1'], 'invalid_input'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total: { currency: 'EUR', minorUnits: -1 } }, customer, minute(0), 'create-key-1'], 'invalid_input'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total: { currency: 'EUR', minorUnits: 1.5 } }, customer, minute(0), 'create-key-1'], 'invalid_input'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total }, customer, minute(0), 'short'], 'invalid_idempotency_key'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total }, customer, '2026-02-30T10:00:00Z', 'create-key-1'], 'invalid_instant'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total }, customer, 'now', 'create-key-1'], 'invalid_instant'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total }, user(STRAY_ID, { role: 'merchant_staff', merchantId: MERCHANT }), minute(0), 'create-key-1'], 'forbidden'],
      [[{ orderId: ORDER, merchantId: MERCHANT, total }, system('payment'), minute(0), 'create-key-1'], 'forbidden'],
    ];
    for (const [args, error] of bad) {
      const r = createOrder(...args);
      assert.equal(r.ok ? 'ok' : r.error, error, JSON.stringify(args));
    }
    const log = created();
    const early = applyCommand([...log], { type: 'request_payment' }, system('payment'), '2026-11-20T11:00:00Z', 'early-key-1', options);
    assert.equal(early.ok ? 'ok' : early.error, 'invalid_instant');
    const unknown = applyCommand(log, { type: 'teleport' } as unknown as Command, system('payment'), minute(1), 'unknown-key', options);
    assert.equal(unknown.ok ? 'ok' : unknown.error, 'invalid_input');
    const proto = applyCommand(log, { type: 'toString' } as unknown as Command, system('payment'), minute(1), 'proto-key-1', options);
    assert.equal(proto.ok ? 'ok' : proto.error, 'invalid_input');
    const noCourier = applyCommand(reach('ready_for_pickup'), { type: 'assign_courier', courierUserId: 'bob' }, support, minute(40), 'courier-key', options);
    assert.equal(noCourier.ok ? 'ok' : noCourier.error, 'invalid_input');
  });

  it('rejects histories with gaps, duplicates, time going backwards or tampering', () => {
    const log = reach('preparing');
    const tamper = (i: number, patch: Partial<OrderEvent>) => log.map((e, j) => (j === i ? { ...e, ...patch } : e));
    const cases: OrderEvent[][] = [
      [],
      log.slice(1),
      [log[0], log[2]],
      [...log, log.at(-1)!],
      tamper(3, { occurredAt: minute(0).replace('12:00', '11:00') }),
      tamper(3, { occurredAt: '2026-11-20T12:03:00+01:00' }),
      tamper(2, { status: 'preparing' }),
      tamper(4, { type: 'toString' as OrderEvent['type'] }),
      tamper(2, { orderId: OTHER_ORDER }),
      tamper(2, { idempotencyKey: log[1].idempotencyKey }),
      tamper(0, { data: { customerUserId: CUSTOMER_ID } }),
      tamper(0, { data: { ...log[0].data, merchantId: 'x' } }),
      tamper(0, { actor: { kind: 'user', userId: OTHER_CUSTOMER_ID, role: 'customer' } }),
      tamper(2, { data: undefined }),
      tamper(2, { actor: { kind: 'user', userId: CUSTOMER_ID, role: 'customer' } }),
      tamper(2, { idempotencyKey: undefined as unknown as string }),
      tamper(3, { actor: { kind: 'user', userId: OTHER_STAFF_ID, role: 'merchant_staff', merchantId: OTHER_MERCHANT } }),
      tamper(4, { reason: 'Jane Doe called from +421900111222' }),
    ];
    for (const events of cases) {
      const r = replay(events);
      assert.equal(r.ok ? 'ok' : r.error, 'invalid_history', JSON.stringify(events.map((e) => [e.sequence, e.type, e.status])));
    }
    const corrupt = applyCommand(tamper(2, { status: 'delivered' }), { type: 'mark_ready' }, staff, minute(40), 'corrupt-key', options);
    assert.equal(corrupt.ok ? 'ok' : corrupt.error, 'invalid_history');
  });

  it('never advances an order with time', () => {
    const log = reach('courier_assigned');
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 20, 12, 30) });
    try {
      const before = replay(log);
      mock.timers.tick(24 * 60 * 60 * 1000);
      const after = replay(log);
      assert.deepEqual(after, before);
      assert.ok(after.ok);
      assert.equal(after.value.status, 'courier_assigned');
      assert.deepEqual(customerTimeline(log), customerTimeline(log));
    } finally {
      mock.timers.reset();
    }
    const dir = new URL('.', import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      assert.doesNotMatch(source, /Date\.now|new Date\(\)|setTimeout|setInterval|performance\.now|\beta\b|duration/i, file);
    }
  });

  it('rejects a support cancellation re-attributed to the customer after confirmation', () => {
    const log = run(reach('preparing'), [[{ type: 'cancel', reason: 'merchant_unreachable' }, support]]);
    const forged = log.map((e, i) => (i === log.length - 1 ? { ...e, actor: { kind: 'user' as const, userId: CUSTOMER_ID, role: 'customer' as const } } : e));
    assert.equal(replay(forged).ok ? 'ok' : 'invalid', 'invalid');
    const early = run(reach('payment_pending'), [[{ type: 'cancel' }, customer]]);
    assert.ok(replay(early).ok);
  });

  it('rejects tampered events: last status, unknown fields, reasons, IDs and acceptance times', () => {
    const lastOf = (log: OrderEvent[], patch: (e: OrderEvent) => OrderEvent) => [...log.slice(0, -1), patch(log.at(-1)!)];
    const preparing = reach('preparing');
    const at = (i: number, patch: Partial<OrderEvent> | Record<string, unknown>) => preparing.map((e, j) => (j === i ? ({ ...e, ...patch } as OrderEvent) : e));
    const delivered = run(reach('picked_up'), [[{ type: 'deliver' }, courier]]);
    const pickedUp = reach('picked_up');
    const assigned = reach('courier_assigned');
    const supportCancel = run(reach('preparing'), [[{ type: 'cancel', reason: 'merchant_unreachable' }, support]]);
    const customerCancel = run(created(), [[{ type: 'cancel' }, customer]]);
    const cases: [string, OrderEvent[]][] = [
      ['status tamper on the last event', lastOf(preparing, (e) => ({ ...e, status: 'ready_for_pickup' }))],
      ['delivered with free-text data', lastOf(delivered, (e) => ({ ...e, data: { note: 'leave at door', eta: '5 min' } }))],
      ['order_created with an e-mail', at(0, { data: { ...preparing[0].data, customerEmail: 'jane@example.com' } })],
      ['top-level courier position', at(4, { courierPosition: '48.14,17.10' })],
      ['actor with an extra field', at(4, { actor: { ...preparing[4].actor, email: 'x@example.com' } })],
      ['reason on picked_up', lastOf(pickedUp, (e) => ({ ...e, reason: 'other' }))],
      ['courierUserId bob', assigned.map((e) => (e.type === 'courier_assigned' ? { ...e, data: { courierUserId: 'bob' } } : e))],
      ['cancelled without its reason', lastOf(supportCancel, ({ reason: _drop, ...e }) => e)],
      ['customer cancel attributed to another customer', lastOf(customerCancel, (e) => ({ ...e, actor: { kind: 'user', userId: OTHER_CUSTOMER_ID, role: 'customer' } }))],
      ['malformed acceptanceDecidedAt', at(3, { data: { acceptanceDecidedAt: 'yesterday' } })],
      ['acceptance decided before confirmation', at(3, { data: { acceptanceDecidedAt: minute(1) } })],
      ['acceptance decided after its event', at(3, { data: { acceptanceDecidedAt: minute(30) } })],
      ['non-UUID actor', at(4, { actor: { kind: 'user', userId: 'u-staff', role: 'merchant_staff', merchantId: MERCHANT } })],
    ];
    for (const [name, events] of cases) {
      const r = replay(events);
      assert.equal(r.ok ? 'ok' : r.error, 'invalid_history', name);
    }
    assert.ok(replay(delivered).ok && replay(supportCancel).ok && replay(customerCancel).ok);
  });

  it('requires UUID user IDs, rejects hour 24 and inconsistent accepted decisions', () => {
    const total = { currency: 'EUR', minorUnits: 100 };
    const named = createOrder({ orderId: ORDER, merchantId: MERCHANT, total }, user('jane', { role: 'customer', merchantId: null }), minute(0), 'create-key-7', options);
    assert.equal(named.ok ? 'ok' : named.error, 'forbidden');
    const hour24 = createOrder({ orderId: ORDER, merchantId: MERCHANT, total }, customer, '2026-11-20T24:00:00Z', 'create-key-8', options);
    assert.equal(hour24.ok ? 'ok' : hour24.error, 'invalid_instant');
    for (const bad of [acceptance('accepted', { declineReason: 'too_busy' }), acceptance('accepted', { receivedAt: minute(1) })]) {
      const r = applyCommand(reach('confirmed'), { type: 'merchant_accept', acceptance: bad }, staff, minute(40), 'accept-case-1', options);
      assert.equal(r.ok ? 'ok' : r.error, 'acceptance_mismatch', JSON.stringify(bad));
    }
  });

  it('rejects a courier event from someone other than the assigned courier in replay', () => {
    const log = reach('picked_up');
    const forged = log.map((e, i) => (i === log.length - 1 ? { ...e, actor: { kind: 'user' as const, userId: 'c0c0c0c0-1111-4222-8333-444455557777', role: 'courier' as const } } : e));
    assert.equal(replay(forged).ok ? 'ok' : 'invalid', 'invalid');
  });

  it('matches user IDs case-insensitively and keeps exported tables frozen', () => {
    const log = reach('courier_assigned');
    const upper = user(COURIER_ID.toUpperCase(), { role: 'courier', merchantId: null });
    assert.ok(applyCommand(log, { type: 'pick_up' }, upper, minute(40), 'upper-key-1', options).ok);
    assert.throws(() => (terminalStatuses as OrderStatus[]).push('created'), TypeError);
  });

  it('exposes only genuine events to the customer', () => {
    const log = run(reach('preparing'), [[{ type: 'cancel', reason: 'merchant_unreachable' }, support]]);
    const timeline = customerTimeline(log);
    assert.ok(timeline.ok);
    assert.equal(timeline.value.status, 'cancelled');
    assert.equal(timeline.value.lastUpdatedAt, log.at(-1)!.occurredAt);
    assert.equal(timeline.value.entries.length, log.length);
    assert.deepEqual(timeline.value.entries.at(-1), { sequence: log.length, type: 'cancelled', status: 'cancelled', occurredAt: log.at(-1)!.occurredAt, reason: 'cancelled_by_support' });
    const text = JSON.stringify(timeline.value);
    for (const hidden of [STAFF_ID, SUPPORT_ID, 'pi_test_123', 'key-', 'fingerprint', 'actor', 'merchant_unreachable']) assert.ok(!text.includes(hidden), hidden);
    const assigned = customerTimeline(reach('courier_assigned'));
    assert.ok(assigned.ok);
    assert.ok(!JSON.stringify(assigned.value).includes(COURIER_ID));
    assert.deepEqual(assigned.value.entries.map((e) => e.status as OrderStatus).at(-1), 'courier_assigned');
    assert.equal(customerTimeline([]).ok, false);
  });
});
