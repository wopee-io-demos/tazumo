export const orderStatuses = Object.freeze([
  'created',
  'payment_pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'courier_assigned',
  'picked_up',
  'delivered',
  'cancelled',
  'failed',
] as const);
export type OrderStatus = (typeof orderStatuses)[number];
export const terminalStatuses: readonly OrderStatus[] = Object.freeze(['delivered', 'cancelled', 'failed'] as const);

export const roles = Object.freeze(['customer', 'merchant_staff', 'courier', 'support', 'admin'] as const);
export type Role = (typeof roles)[number];
export type Grant = { role: Role; merchantId: string | null };
export type Principal = { userId: string; grants: Grant[] };

export const systemSources = Object.freeze(['payment', 'acceptance', 'dispatch', 'operations'] as const);
export type SystemSource = (typeof systemSources)[number];
export type Actor = { kind: 'user'; principal: Principal } | { kind: 'system'; source: SystemSource };
export type ActorRef = { kind: 'user'; userId: string; role: Role; merchantId?: string } | { kind: 'system'; source: SystemSource };

export type Money = { currency: string; minorUnits: number };

export const declineReasons = Object.freeze(['out_of_stock', 'too_busy', 'closing_soon', 'other'] as const);
export const acceptanceStates = Object.freeze(['pending', 'accepted', 'declined', 'auto_declined'] as const);
export type AcceptanceDecision = {
  orderId: string;
  merchantId: string;
  state: (typeof acceptanceStates)[number];
  receivedAt: string;
  deadline: string;
  decidedAt?: string;
  declineReason?: string;
};

export type Command =
  | { type: 'request_payment' }
  | { type: 'payment_authorized'; paymentReference: string }
  | { type: 'payment_failed'; reason: string }
  | { type: 'merchant_accept'; acceptance: AcceptanceDecision }
  | { type: 'merchant_decline'; acceptance: AcceptanceDecision }
  | { type: 'auto_decline'; acceptance: AcceptanceDecision }
  | { type: 'start_preparing' }
  | { type: 'mark_ready' }
  | { type: 'assign_courier'; courierUserId: string }
  | { type: 'pick_up' }
  | { type: 'deliver' }
  | { type: 'cancel'; reason?: string }
  | { type: 'fail'; reason: string };
export type CommandType = Command['type'];

export const eventTypes = Object.freeze([
  'order_created',
  'payment_requested',
  'payment_authorized',
  'payment_failed',
  'merchant_accepted',
  'merchant_declined',
  'merchant_auto_declined',
  'preparation_started',
  'marked_ready',
  'courier_assigned',
  'picked_up',
  'delivered',
  'cancelled',
  'failed',
] as const);
export type EventType = (typeof eventTypes)[number];

export type OrderEvent = {
  id: string;
  orderId: string;
  sequence: number;
  type: EventType;
  occurredAt: string;
  status: OrderStatus;
  actor: ActorRef;
  idempotencyKey: string;
  fingerprint: string;
  reason?: string;
  data?: Record<string, string | number>;
};

export type OrderState = {
  id: string;
  customerUserId: string;
  merchantId: string;
  total: Money;
  status: OrderStatus;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  merchantAccepted: boolean;
  confirmedAt: string | null;
  courierUserId: string | null;
  paymentReference: string | null;
  reason: string | null;
};

export type OrderError =
  | 'invalid_input'
  | 'invalid_instant'
  | 'invalid_idempotency_key'
  | 'invalid_history'
  | 'illegal_transition'
  | 'forbidden'
  | 'reason_required'
  | 'acceptance_mismatch'
  | 'idempotency_conflict';

export type Result<T> = { ok: true; value: T } | { ok: false; error: OrderError; detail?: string };
