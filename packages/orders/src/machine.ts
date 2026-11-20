import {
  declineReasons,
  terminalStatuses,
  type AcceptanceDecision,
  type Actor,
  type ActorRef,
  type Command,
  type CommandType,
  type EventType,
  type Money,
  type OrderError,
  type OrderEvent,
  type OrderState,
  type OrderStatus,
  type Result,
  type Role,
  type SystemSource,
} from './types.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasonCode = /^[a-z][a-z_]{0,63}$/;
const reference = /^[A-Za-z0-9_-]{1,128}$/;
const idempotencyKey = /^[A-Za-z0-9_-]{8,128}$/;
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const fail = (error: OrderError, detail?: string): { ok: false; error: OrderError; detail?: string } => ({ ok: false, error, detail });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonTerminal = (s: OrderState) => !terminalStatuses.includes(s.status);

export function toInstant(at: string): string | null {
  if (typeof at !== 'string' || !isoInstant.test(at)) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const [y, m, d] = at.slice(0, 10).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return null;
  return date.toISOString();
}

export function validateMoney(money: unknown): money is Money {
  return (
    isObject(money) &&
    typeof money.currency === 'string' &&
    /^[A-Z]{3}$/.test(money.currency) &&
    Number.isSafeInteger(money.minorUnits) &&
    (money.minorUnits as number) >= 0
  );
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

type Effect = { to: (s: OrderState) => OrderStatus; allowed: (s: OrderState) => boolean };
const move = (from: OrderStatus[], to: OrderStatus): Effect => ({ allowed: (s) => from.includes(s.status), to: () => to });

export const transitions: Record<Exclude<EventType, 'order_created'>, Effect> = {
  payment_requested: move(['created'], 'payment_pending'),
  payment_authorized: move(['payment_pending'], 'confirmed'),
  payment_failed: move(['payment_pending'], 'failed'),
  merchant_accepted: { allowed: (s) => s.status === 'confirmed' && !s.merchantAccepted, to: () => 'confirmed' },
  merchant_declined: { allowed: (s) => s.status === 'confirmed' && !s.merchantAccepted, to: () => 'cancelled' },
  merchant_auto_declined: { allowed: (s) => s.status === 'confirmed' && !s.merchantAccepted, to: () => 'cancelled' },
  preparation_started: { allowed: (s) => s.status === 'confirmed' && s.merchantAccepted, to: () => 'preparing' },
  marked_ready: move(['preparing'], 'ready_for_pickup'),
  courier_assigned: move(['ready_for_pickup'], 'courier_assigned'),
  picked_up: move(['courier_assigned'], 'picked_up'),
  delivered: move(['picked_up'], 'delivered'),
  cancelled: { allowed: isNonTerminal, to: () => 'cancelled' },
  failed: { allowed: isNonTerminal, to: () => 'failed' },
};

type Who = 'customer' | 'own_staff' | 'assigned_courier' | 'support';
type Rule = {
  event: Exclude<EventType, 'order_created'>;
  system?: SystemSource[];
  users?: { who: Who; from?: OrderStatus[] }[];
};

const rules: Record<CommandType, Rule> = {
  request_payment: { event: 'payment_requested', system: ['payment'] },
  payment_authorized: { event: 'payment_authorized', system: ['payment'] },
  payment_failed: { event: 'payment_failed', system: ['payment'] },
  merchant_accept: { event: 'merchant_accepted', users: [{ who: 'own_staff' }] },
  merchant_decline: { event: 'merchant_declined', users: [{ who: 'own_staff' }] },
  auto_decline: { event: 'merchant_auto_declined', system: ['acceptance'] },
  start_preparing: { event: 'preparation_started', users: [{ who: 'own_staff' }] },
  mark_ready: { event: 'marked_ready', users: [{ who: 'own_staff' }] },
  assign_courier: { event: 'courier_assigned', system: ['dispatch'], users: [{ who: 'support' }] },
  pick_up: { event: 'picked_up', users: [{ who: 'assigned_courier' }] },
  deliver: { event: 'delivered', users: [{ who: 'assigned_courier' }] },
  cancel: { event: 'cancelled', users: [{ who: 'customer', from: ['created', 'payment_pending'] }, { who: 'support' }] },
  fail: { event: 'failed', system: ['operations'] },
};

function validPrincipal(actor: Actor): boolean {
  if (actor.kind !== 'user') return false;
  const p = actor.principal;
  return isObject(p) && typeof p.userId === 'string' && p.userId.length > 0 && Array.isArray(p.grants);
}

function matchWho(actor: Actor, who: Who, state: OrderState): Role | null {
  if (!validPrincipal(actor) || actor.kind !== 'user') return null;
  const { userId, grants } = actor.principal;
  const has = (role: Role, merchantId?: string) =>
    grants.some((g) => isObject(g) && g.role === role && (merchantId === undefined || g.merchantId === merchantId));
  switch (who) {
    case 'customer':
      return userId === state.customerUserId && has('customer') ? 'customer' : null;
    case 'own_staff':
      return has('merchant_staff', state.merchantId) ? 'merchant_staff' : null;
    case 'assigned_courier':
      return state.courierUserId !== null && userId === state.courierUserId && has('courier') ? 'courier' : null;
    case 'support':
      return has('admin') ? 'admin' : has('support') ? 'support' : null;
  }
}

function authorize(rule: Rule, actor: Actor, state: OrderState): Result<ActorRef> {
  if (!isObject(actor)) return fail('forbidden');
  if (actor.kind === 'system') {
    return rule.system?.includes(actor.source) ? { ok: true, value: { kind: 'system', source: actor.source } } : fail('forbidden');
  }
  let permittedElsewhere = false;
  for (const { who, from } of rule.users ?? []) {
    const role = matchWho(actor, who, state);
    if (!role) continue;
    if (from && !from.includes(state.status)) {
      permittedElsewhere = true;
      continue;
    }
    return { ok: true, value: { kind: 'user', userId: actor.principal.userId, role } };
  }
  return permittedElsewhere ? fail('illegal_transition', `cancel is not allowed from ${state.status} by this actor`) : fail('forbidden');
}

function checkAcceptance(acceptance: unknown, state: OrderState, expected: AcceptanceDecision['state']): Result<AcceptanceDecision> {
  if (!isObject(acceptance)) return fail('invalid_input', 'acceptance is required');
  const a = acceptance as AcceptanceDecision;
  if (a.orderId !== state.id || a.merchantId !== state.merchantId || a.state !== expected) {
    return fail('acceptance_mismatch', `acceptance must be ${expected} for this order and merchant`);
  }
  if (typeof a.decidedAt !== 'string' || !toInstant(a.decidedAt)) return fail('acceptance_mismatch', 'acceptance has no decision time');
  return { ok: true, value: a };
}

type Draft = { reason?: string; data?: Record<string, string | number> };

function payload(command: Command, state: OrderState, actor: ActorRef): Result<Draft> {
  switch (command.type) {
    case 'payment_authorized':
      return typeof command.paymentReference === 'string' && reference.test(command.paymentReference)
        ? { ok: true, value: { data: { paymentReference: command.paymentReference } } }
        : fail('invalid_input', 'paymentReference must be an opaque provider reference');
    case 'merchant_accept': {
      const a = checkAcceptance(command.acceptance, state, 'accepted');
      return a.ok ? { ok: true, value: { data: { acceptanceDecidedAt: a.value.decidedAt! } } } : a;
    }
    case 'merchant_decline': {
      const a = checkAcceptance(command.acceptance, state, 'declined');
      if (!a.ok) return a;
      const reason = a.value.declineReason ?? '';
      return (declineReasons as readonly string[]).includes(reason) ? { ok: true, value: { reason } } : fail('reason_required');
    }
    case 'auto_decline': {
      const a = checkAcceptance(command.acceptance, state, 'auto_declined');
      return a.ok ? { ok: true, value: { reason: 'window_expired' } } : a;
    }
    case 'assign_courier':
      return typeof command.courierUserId === 'string' && uuid.test(command.courierUserId)
        ? { ok: true, value: { data: { courierUserId: command.courierUserId.toLowerCase() } } }
        : fail('invalid_input', 'courierUserId must be a UUID');
    case 'cancel':
      if (command.reason === undefined && actor.kind === 'user' && actor.role === 'customer') {
        return { ok: true, value: { reason: 'customer_request' } };
      }
      return typeof command.reason === 'string' && reasonCode.test(command.reason) ? { ok: true, value: { reason: command.reason } } : fail('reason_required');
    case 'payment_failed':
    case 'fail':
      return typeof command.reason === 'string' && reasonCode.test(command.reason) ? { ok: true, value: { reason: command.reason } } : fail('reason_required');
    default:
      return { ok: true, value: {} };
  }
}

function reduce(state: OrderState, event: OrderEvent): OrderState {
  const next: OrderState = { ...state, status: event.status, sequence: event.sequence, updatedAt: event.occurredAt };
  if (event.type === 'merchant_accepted') next.merchantAccepted = true;
  if (event.type === 'courier_assigned') next.courierUserId = String(event.data?.courierUserId);
  if (event.type === 'payment_authorized') next.paymentReference = String(event.data?.paymentReference);
  if (event.reason !== undefined) next.reason = event.reason;
  return next;
}

export type CreateOrderInput = { orderId: string; merchantId: string; total: Money };
export type Options = { newId?: () => string };
export type Applied = { state: OrderState; event: OrderEvent; replayed: boolean };

const newEventId = (options?: Options) => (options?.newId ?? (() => globalThis.crypto.randomUUID()))();

export function createOrder(input: CreateOrderInput, actor: Actor, at: string, key: string, options?: Options): Result<Applied> {
  if (!isObject(input) || typeof input.orderId !== 'string' || !uuid.test(input.orderId) || typeof input.merchantId !== 'string' || !uuid.test(input.merchantId)) {
    return fail('invalid_input', 'orderId and merchantId must be UUIDs');
  }
  if (!validateMoney(input.total)) return fail('invalid_input', 'total must be non-negative integer minor units with an ISO 4217 code');
  if (typeof key !== 'string' || !idempotencyKey.test(key)) return fail('invalid_idempotency_key');
  const occurredAt = toInstant(at);
  if (!occurredAt) return fail('invalid_instant');
  if (!isObject(actor) || actor.kind !== 'user' || !validPrincipal(actor)) return fail('forbidden');
  const { userId, grants } = actor.principal;
  if (!grants.some((g) => isObject(g) && g.role === 'customer')) return fail('forbidden');
  const event: OrderEvent = {
    id: newEventId(options),
    orderId: input.orderId.toLowerCase(),
    sequence: 1,
    type: 'order_created',
    occurredAt,
    status: 'created',
    actor: { kind: 'user', userId, role: 'customer' },
    idempotencyKey: key,
    fingerprint: canonical({ command: 'create', input, actor: userId }),
    data: {
      customerUserId: userId,
      merchantId: input.merchantId.toLowerCase(),
      currency: input.total.currency,
      minorUnits: input.total.minorUnits,
    },
  };
  const state = replay([event]);
  return state.ok ? { ok: true, value: { state: state.value, event, replayed: false } } : state;
}

function initial(event: OrderEvent): Result<OrderState> {
  const d = event.data ?? {};
  const total = { currency: d.currency, minorUnits: d.minorUnits };
  if (event.type !== 'order_created' || event.sequence !== 1 || event.status !== 'created' || !uuid.test(event.orderId)) {
    return fail('invalid_history', 'the first event must be order_created with sequence 1');
  }
  if (typeof d.customerUserId !== 'string' || typeof d.merchantId !== 'string' || !validateMoney(total)) {
    return fail('invalid_history', 'order_created lacks customer, merchant or total');
  }
  return {
    ok: true,
    value: {
      id: event.orderId,
      customerUserId: d.customerUserId,
      merchantId: d.merchantId,
      total,
      status: 'created',
      sequence: 1,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      merchantAccepted: false,
      courierUserId: null,
      paymentReference: null,
      reason: null,
    },
  };
}

export function replay(events: readonly OrderEvent[]): Result<OrderState> {
  if (!Array.isArray(events) || events.length === 0) return fail('invalid_history', 'no events');
  const keys = new Set<string>();
  let state: OrderState | null = null;
  for (const event of events) {
    if (typeof event !== 'object' || event === null || toInstant(event.occurredAt) !== event.occurredAt) return fail('invalid_history', 'event time is not a normalised instant');
    if (keys.has(event.idempotencyKey)) return fail('invalid_history', `duplicate idempotency key at sequence ${event.sequence}`);
    keys.add(event.idempotencyKey);
    if (!state) {
      const first = initial(event);
      if (!first.ok) return first;
      state = first.value;
      continue;
    }
    if (event.orderId !== state.id) return fail('invalid_history', 'event belongs to another order');
    if (event.sequence !== state.sequence + 1) return fail('invalid_history', `expected sequence ${state.sequence + 1}, got ${event.sequence}`);
    if (event.occurredAt < state.updatedAt) return fail('invalid_history', `time goes backwards at sequence ${event.sequence}`);
    const effect = event.type !== 'order_created' && Object.hasOwn(transitions, event.type) ? transitions[event.type as keyof typeof transitions] : undefined;
    if (!effect || !effect.allowed(state) || effect.to(state) !== event.status) {
      return fail('invalid_history', `${event.type} is not allowed from ${state.status}`);
    }
    if (event.type === 'courier_assigned' && !uuid.test(String(event.data?.courierUserId))) return fail('invalid_history', 'courier_assigned lacks courierUserId');
    state = reduce(state, event);
  }
  return { ok: true, value: state! };
}

export function applyCommand(events: readonly OrderEvent[], command: Command, actor: Actor, at: string, key: string, options?: Options): Result<Applied> {
  const history = replay(events);
  if (!history.ok) return history;
  const state = history.value;
  if (!isObject(command) || !Object.hasOwn(rules, command.type as string)) return fail('invalid_input', 'unknown command');
  if (typeof key !== 'string' || !idempotencyKey.test(key)) return fail('invalid_idempotency_key');
  const actorId = isObject(actor) ? (actor.kind === 'system' ? `system:${actor.source}` : actor.principal?.userId) : undefined;
  const fingerprint = canonical({ command, actor: actorId });
  const previous = events.find((e) => e.idempotencyKey === key);
  if (previous) {
    return previous.fingerprint === fingerprint ? { ok: true, value: { state, event: previous, replayed: true } } : fail('idempotency_conflict');
  }
  const occurredAt = toInstant(at);
  if (!occurredAt) return fail('invalid_instant');
  if (occurredAt < state.updatedAt) return fail('invalid_instant', 'earlier than the last event');

  const rule = rules[command.type];
  const who = authorize(rule, actor, state);
  if (!who.ok) return who;
  const effect = transitions[rule.event];
  if (!effect.allowed(state)) return fail('illegal_transition', `${command.type} is not allowed from ${state.status}`);
  const draft = payload(command, state, who.value);
  if (!draft.ok) return draft;

  const event: OrderEvent = {
    id: newEventId(options),
    orderId: state.id,
    sequence: state.sequence + 1,
    type: rule.event,
    occurredAt,
    status: effect.to(state),
    actor: who.value,
    idempotencyKey: key,
    fingerprint,
    ...draft.value,
  };
  return { ok: true, value: { state: reduce(state, event), event, replayed: false } };
}
