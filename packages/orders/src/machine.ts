import {
  declineReasons,
  systemSources,
  terminalStatuses,
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

type Failure = { ok: false; error: OrderError; detail?: string };
const fail = (error: OrderError, detail?: string): Failure => ({ ok: false, error, detail });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonTerminal = (s: OrderState) => !terminalStatuses.includes(s.status);
const sameId = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((k) => keys.includes(k));

export function toInstant(at: unknown): string | null {
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
    hasOnly(money, ['currency', 'minorUnits']) &&
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

type Effect = { readonly to: OrderStatus; readonly allowed: (s: OrderState) => boolean };
const move = (from: OrderStatus[], to: OrderStatus): Effect => Object.freeze({ allowed: (s: OrderState) => from.includes(s.status), to });
const beforeAcceptance = (s: OrderState) => s.status === 'confirmed' && !s.merchantAccepted;

const transitions: Readonly<Record<Exclude<EventType, 'order_created'>, Effect>> = Object.freeze({
  payment_requested: move(['created'], 'payment_pending'),
  payment_authorized: move(['payment_pending'], 'confirmed'),
  payment_failed: move(['payment_pending'], 'failed'),
  merchant_accepted: Object.freeze({ allowed: beforeAcceptance, to: 'confirmed' as const }),
  merchant_declined: Object.freeze({ allowed: beforeAcceptance, to: 'cancelled' as const }),
  merchant_auto_declined: Object.freeze({ allowed: beforeAcceptance, to: 'cancelled' as const }),
  preparation_started: Object.freeze({ allowed: (s: OrderState) => s.status === 'confirmed' && s.merchantAccepted, to: 'preparing' as const }),
  marked_ready: move(['preparing'], 'ready_for_pickup'),
  courier_assigned: move(['ready_for_pickup'], 'courier_assigned'),
  picked_up: move(['courier_assigned'], 'picked_up'),
  delivered: move(['picked_up'], 'delivered'),
  cancelled: Object.freeze({ allowed: isNonTerminal, to: 'cancelled' as const }),
  failed: Object.freeze({ allowed: isNonTerminal, to: 'failed' as const }),
});

type Who = 'customer' | 'own_staff' | 'assigned_courier' | 'support';
type Rule = {
  event: Exclude<EventType, 'order_created'>;
  fields: readonly string[];
  system?: readonly SystemSource[];
  users?: readonly { who: Who; from?: readonly OrderStatus[] }[];
};

const rules: Readonly<Record<CommandType, Rule>> = Object.freeze({
  request_payment: { event: 'payment_requested', fields: [], system: ['payment'] },
  payment_authorized: { event: 'payment_authorized', fields: ['paymentReference'], system: ['payment'] },
  payment_failed: { event: 'payment_failed', fields: ['reason'], system: ['payment'] },
  merchant_accept: { event: 'merchant_accepted', fields: ['acceptance'], users: [{ who: 'own_staff' }] },
  merchant_decline: { event: 'merchant_declined', fields: ['acceptance'], users: [{ who: 'own_staff' }] },
  auto_decline: { event: 'merchant_auto_declined', fields: ['acceptance'], system: ['acceptance'] },
  start_preparing: { event: 'preparation_started', fields: [], users: [{ who: 'own_staff' }] },
  mark_ready: { event: 'marked_ready', fields: [], users: [{ who: 'own_staff' }] },
  assign_courier: { event: 'courier_assigned', fields: ['courierUserId'], system: ['dispatch'], users: [{ who: 'support' }] },
  pick_up: { event: 'picked_up', fields: [], users: [{ who: 'assigned_courier' }] },
  deliver: { event: 'delivered', fields: [], users: [{ who: 'assigned_courier' }] },
  cancel: { event: 'cancelled', fields: ['reason'], users: [{ who: 'customer', from: ['created', 'payment_pending'] }, { who: 'support' }] },
  fail: { event: 'failed', fields: ['reason'], system: ['operations'] },
});

const roleOf: Record<Who, readonly Role[]> = { customer: ['customer'], own_staff: ['merchant_staff'], assigned_courier: ['courier'], support: ['support', 'admin'] };
const reasonRequired: ReadonlySet<EventType> = new Set(['payment_failed', 'merchant_declined', 'merchant_auto_declined', 'cancelled', 'failed']);

function principalOf(actor: unknown): { userId: string; grants: unknown[] } | null {
  if (!isObject(actor) || actor.kind !== 'user' || !isObject(actor.principal)) return null;
  const { userId, grants } = actor.principal;
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 255 && Array.isArray(grants) ? { userId, grants } : null;
}

function matchWho(actor: Actor, who: Who, state: OrderState): ActorRef | null {
  const principal = principalOf(actor);
  if (!principal) return null;
  const { userId, grants } = principal;
  const has = (role: Role, merchantId?: string) =>
    grants.some((g) => isObject(g) && g.role === role && (merchantId === undefined || sameId(g.merchantId, merchantId)));
  switch (who) {
    case 'customer':
      return sameId(userId, state.customerUserId) && has('customer') ? { kind: 'user', userId, role: 'customer' } : null;
    case 'own_staff':
      return has('merchant_staff', state.merchantId) ? { kind: 'user', userId, role: 'merchant_staff', merchantId: state.merchantId } : null;
    case 'assigned_courier':
      return sameId(userId, state.courierUserId) && has('courier') ? { kind: 'user', userId, role: 'courier' } : null;
    case 'support':
      return has('admin') ? { kind: 'user', userId, role: 'admin' } : has('support') ? { kind: 'user', userId, role: 'support' } : null;
  }
}

type Identity = { ref: ActorRef; from?: readonly OrderStatus[] }[];

function identify(rule: Rule, actor: Actor): (state: OrderState) => Identity {
  return (state) => {
    if (isObject(actor) && actor.kind === 'system') {
      return rule.system?.includes(actor.source) ? [{ ref: { kind: 'system', source: actor.source } }] : [];
    }
    return (rule.users ?? []).flatMap(({ who, from }) => {
      const ref = matchWho(actor, who, state);
      return ref ? [{ ref, from }] : [];
    });
  };
}

type Normalized = Record<string, string>;

function normalizeAcceptance(value: unknown): Result<Normalized> {
  const keys = ['orderId', 'merchantId', 'state', 'receivedAt', 'deadline', 'decidedAt', 'declineReason'];
  if (!isObject(value) || !hasOnly(value, keys)) return fail('invalid_input', 'acceptance has missing or unknown fields');
  const receivedAt = toInstant(value.receivedAt);
  const deadline = toInstant(value.deadline);
  const decidedAt = toInstant(value.decidedAt);
  const known = [...declineReasons, 'window_expired'] as readonly unknown[];
  if (typeof value.orderId !== 'string' || !uuid.test(value.orderId) || typeof value.merchantId !== 'string' || !uuid.test(value.merchantId)) {
    return fail('acceptance_mismatch', 'acceptance IDs must be UUIDs');
  }
  if (!receivedAt || !deadline || !decidedAt) return fail('acceptance_mismatch', 'acceptance is not decided or has invalid times');
  if (value.declineReason !== undefined && !known.includes(value.declineReason)) return fail('reason_required');
  return {
    ok: true,
    value: {
      orderId: value.orderId.toLowerCase(),
      merchantId: value.merchantId.toLowerCase(),
      state: String(value.state),
      receivedAt,
      deadline,
      decidedAt,
      ...(value.declineReason !== undefined ? { declineReason: String(value.declineReason) } : {}),
    },
  };
}

function normalizeCommand(command: Command): Result<Normalized & { type: CommandType }> {
  if (!isObject(command) || typeof command.type !== 'string' || !Object.hasOwn(rules, command.type)) return fail('invalid_input', 'unknown command');
  const type = command.type as CommandType;
  const raw = command as Record<string, unknown>;
  const rule = rules[type];
  if (!hasOnly(raw, ['type', ...rule.fields])) return fail('invalid_input', `unknown fields for ${type}`);
  const out: Normalized & { type: CommandType } = { type };
  if (rule.fields.includes('reason') && raw.reason !== undefined) {
    if (typeof raw.reason !== 'string' || !reasonCode.test(raw.reason)) return fail('reason_required', 'reason must be a code');
    out.reason = raw.reason;
  }
  if (rule.fields.includes('paymentReference')) {
    if (typeof raw.paymentReference !== 'string' || !reference.test(raw.paymentReference)) return fail('invalid_input', 'paymentReference must be an opaque provider reference');
    out.paymentReference = raw.paymentReference;
  }
  if (rule.fields.includes('courierUserId')) {
    if (typeof raw.courierUserId !== 'string' || !uuid.test(raw.courierUserId)) return fail('invalid_input', 'courierUserId must be a UUID');
    out.courierUserId = raw.courierUserId.toLowerCase();
  }
  if (rule.fields.includes('acceptance')) {
    const acceptance = normalizeAcceptance(raw.acceptance);
    if (!acceptance.ok) return acceptance;
    for (const [k, v] of Object.entries(acceptance.value)) out[`acceptance.${k}`] = v;
  }
  return { ok: true, value: out };
}

const expectedAcceptance: Partial<Record<CommandType, string>> = { merchant_accept: 'accepted', merchant_decline: 'declined', auto_decline: 'auto_declined' };

function checkAcceptance(type: CommandType, c: Normalized, state: OrderState, at: string): Result<Normalized> {
  const expected = expectedAcceptance[type];
  if (!expected) return { ok: true, value: {} };
  const { orderId, merchantId, state: decision, receivedAt, deadline, decidedAt, declineReason } = Object.fromEntries(
    Object.entries(c)
      .filter(([k]) => k.startsWith('acceptance.'))
      .map(([k, v]) => [k.slice('acceptance.'.length), v]),
  );
  if (orderId !== state.id || merchantId !== state.merchantId || decision !== expected) {
    return fail('acceptance_mismatch', `acceptance must be ${expected} for this order and merchant`);
  }
  if (receivedAt < state.createdAt || decidedAt < receivedAt || decidedAt > at) return fail('acceptance_mismatch', 'acceptance times are inconsistent with the order');
  if (expected === 'auto_declined' ? decidedAt < deadline || declineReason !== 'window_expired' : decidedAt >= deadline) {
    return fail('acceptance_mismatch', 'acceptance decision is inconsistent with its deadline');
  }
  if (expected === 'declined' && !(declineReasons as readonly string[]).includes(declineReason ?? '')) return fail('reason_required');
  return { ok: true, value: { decidedAt, ...(declineReason ? { reason: declineReason } : {}) } };
}

type Draft = { reason?: string; data?: Record<string, string | number> };

function draftFor(type: CommandType, c: Normalized, actor: ActorRef, acceptance: Normalized): Result<Draft> {
  switch (type) {
    case 'payment_authorized':
      return { ok: true, value: { data: { paymentReference: c.paymentReference } } };
    case 'merchant_accept':
      return { ok: true, value: { data: { acceptanceDecidedAt: acceptance.decidedAt } } };
    case 'merchant_decline':
    case 'auto_decline':
      return { ok: true, value: { reason: acceptance.reason, data: { acceptanceDecidedAt: acceptance.decidedAt } } };
    case 'assign_courier':
      return { ok: true, value: { data: { courierUserId: c.courierUserId } } };
    case 'cancel':
      if (c.reason) return { ok: true, value: { reason: c.reason } };
      return actor.kind === 'user' && actor.role === 'customer' ? { ok: true, value: { reason: 'customer_request' } } : fail('reason_required');
    case 'payment_failed':
    case 'fail':
      return c.reason ? { ok: true, value: { reason: c.reason } } : fail('reason_required');
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
  if (!isObject(input) || !hasOnly(input, ['orderId', 'merchantId', 'total'])) return fail('invalid_input', 'unknown fields');
  if (typeof input.orderId !== 'string' || !uuid.test(input.orderId) || typeof input.merchantId !== 'string' || !uuid.test(input.merchantId)) {
    return fail('invalid_input', 'orderId and merchantId must be UUIDs');
  }
  if (!validateMoney(input.total)) return fail('invalid_input', 'total must be non-negative integer minor units with an ISO 4217 code');
  if (typeof key !== 'string' || !idempotencyKey.test(key)) return fail('invalid_idempotency_key');
  const occurredAt = toInstant(at);
  if (!occurredAt) return fail('invalid_instant');
  const principal = principalOf(actor);
  if (!principal || !principal.grants.some((g) => isObject(g) && g.role === 'customer')) return fail('forbidden');
  const data = {
    customerUserId: principal.userId,
    merchantId: input.merchantId.toLowerCase(),
    currency: input.total.currency,
    minorUnits: input.total.minorUnits,
  };
  const actorRef: ActorRef = { kind: 'user', userId: principal.userId, role: 'customer' };
  const orderId = input.orderId.toLowerCase();
  const event: OrderEvent = {
    id: newEventId(options),
    orderId,
    sequence: 1,
    type: 'order_created',
    occurredAt,
    status: 'created',
    actor: actorRef,
    idempotencyKey: key,
    fingerprint: canonical({ type: 'create', orderId, data, actor: actorRef }),
    data,
  };
  const state = replay([event]);
  return state.ok ? { ok: true, value: { state: state.value, event, replayed: false } } : state;
}

const eventActors = new Map<EventType, { system: readonly string[]; users: readonly Who[] }>(
  Object.values(rules).map((r) => [r.event, { system: r.system ?? [], users: (r.users ?? []).map((u) => u.who) }]),
);

function validEventActor(event: OrderEvent, state: OrderState): boolean {
  const allowed = eventActors.get(event.type);
  const a = event.actor as unknown;
  if (!allowed || !isObject(a)) return false;
  if (a.kind === 'system') return (systemSources as readonly unknown[]).includes(a.source) && allowed.system.includes(a.source as string);
  if (a.kind !== 'user' || typeof a.userId !== 'string' || a.userId.length === 0) return false;
  return allowed.users.some((who) => {
    if (!roleOf[who].includes(a.role as Role)) return false;
    if (who === 'customer') return sameId(a.userId, state.customerUserId);
    if (who === 'own_staff') return sameId(a.merchantId, state.merchantId);
    if (who === 'assigned_courier') return sameId(a.userId, state.courierUserId);
    return true;
  });
}

function validEventPayload(event: OrderEvent): boolean {
  const d = event.data ?? {};
  if (event.reason !== undefined && (typeof event.reason !== 'string' || !reasonCode.test(event.reason))) return false;
  if (reasonRequired.has(event.type) && event.reason === undefined) return false;
  if (event.type === 'merchant_declined' && !(declineReasons as readonly string[]).includes(event.reason ?? '')) return false;
  if (event.type === 'merchant_auto_declined' && event.reason !== 'window_expired') return false;
  if (event.type === 'payment_authorized') return typeof d.paymentReference === 'string' && reference.test(d.paymentReference);
  if (event.type === 'courier_assigned') return typeof d.courierUserId === 'string' && uuid.test(d.courierUserId);
  if (event.type.startsWith('merchant_')) return toInstant(d.acceptanceDecidedAt) === d.acceptanceDecidedAt;
  return true;
}

function initial(event: OrderEvent): Result<OrderState> {
  const d = event.data ?? {};
  const total = { currency: d.currency, minorUnits: d.minorUnits };
  if (event.type !== 'order_created' || event.sequence !== 1 || event.status !== 'created' || typeof event.orderId !== 'string' || !uuid.test(event.orderId)) {
    return fail('invalid_history', 'the first event must be order_created with sequence 1');
  }
  if (typeof d.customerUserId !== 'string' || d.customerUserId.length === 0 || typeof d.merchantId !== 'string' || !uuid.test(d.merchantId) || !validateMoney(total)) {
    return fail('invalid_history', 'order_created lacks customer, merchant or total');
  }
  const a = event.actor as unknown;
  if (!isObject(a) || a.kind !== 'user' || a.role !== 'customer' || a.userId !== d.customerUserId) return fail('invalid_history', 'order_created must be made by its customer');
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
    if (typeof event.idempotencyKey !== 'string' || !idempotencyKey.test(event.idempotencyKey) || keys.has(event.idempotencyKey)) {
      return fail('invalid_history', `missing or duplicate idempotency key at sequence ${event.sequence}`);
    }
    if (typeof event.id !== 'string' || typeof event.fingerprint !== 'string') return fail('invalid_history', 'event lacks id or fingerprint');
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
    if (!effect || !effect.allowed(state) || effect.to !== event.status) return fail('invalid_history', `${event.type} is not allowed from ${state.status}`);
    if (!validEventActor(event, state)) return fail('invalid_history', `${event.type} has an actor that may not produce it`);
    if (!validEventPayload(event)) return fail('invalid_history', `${event.type} has an invalid reason or data`);
    state = reduce(state, event);
  }
  return { ok: true, value: state! };
}

export function applyCommand(events: readonly OrderEvent[], command: Command, actor: Actor, at: string, key: string, options?: Options): Result<Applied> {
  const history = replay(events);
  if (!history.ok) return history;
  const state = history.value;
  const normalized = normalizeCommand(command);
  if (!normalized.ok) return normalized;
  const c = normalized.value;
  if (typeof key !== 'string' || !idempotencyKey.test(key)) return fail('invalid_idempotency_key');

  const rule = rules[c.type];
  const identities = identify(rule, actor)(state);
  if (identities.length === 0) return fail('forbidden');
  const actorKey = identities[0].ref.kind === 'system' ? `system:${identities[0].ref.source}` : `user:${identities[0].ref.userId}`;
  const fingerprint = canonical({ command: c, actor: actorKey });
  const previous = events.find((e) => e.idempotencyKey === key);
  if (previous) {
    return previous.fingerprint === fingerprint ? { ok: true, value: { state, event: previous, replayed: true } } : fail('idempotency_conflict');
  }

  const occurredAt = toInstant(at);
  if (!occurredAt) return fail('invalid_instant');
  if (occurredAt < state.updatedAt) return fail('invalid_instant', 'earlier than the last event');
  const identity = identities.find((i) => !i.from || i.from.includes(state.status));
  if (!identity) return fail('illegal_transition', `${c.type} is not allowed from ${state.status} for this actor`);
  const effect = transitions[rule.event];
  if (!effect.allowed(state)) return fail('illegal_transition', `${c.type} is not allowed from ${state.status}`);
  const acceptance = checkAcceptance(c.type, c, state, occurredAt);
  if (!acceptance.ok) return acceptance;
  const draft = draftFor(c.type, c, identity.ref, acceptance.value);
  if (!draft.ok) return draft;

  const event: OrderEvent = {
    id: newEventId(options),
    orderId: state.id,
    sequence: state.sequence + 1,
    type: rule.event,
    occurredAt,
    status: effect.to,
    actor: identity.ref,
    idempotencyKey: key,
    fingerprint,
    ...draft.value,
  };
  return { ok: true, value: { state: reduce(state, event), event, replayed: false } };
}
