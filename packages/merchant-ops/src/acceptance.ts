import { matchingRole, toInstant, type AuditEntry, type Principal, type Result } from './actors.ts';

export const declineReasons = ['out_of_stock', 'too_busy', 'closing_soon', 'other'] as const;
export type DeclineReason = (typeof declineReasons)[number];

export const acceptanceWindowMinutes = { min: 1, max: 30 } as const;

export type OrderAcceptance = {
  orderId: string;
  merchantId: string;
  state: 'pending' | 'accepted' | 'declined' | 'auto_declined';
  receivedAt: string;
  deadline: string;
  decidedAt?: string;
  declineReason?: DeclineReason | 'window_expired';
};

export function openAcceptanceWindow(orderId: string, merchantId: string, receivedAt: Date | string, windowMinutes: number): OrderAcceptance {
  const received = toInstant(receivedAt);
  if (!received) throw new RangeError('receivedAt is not a valid instant');
  if (!Number.isInteger(windowMinutes) || windowMinutes < acceptanceWindowMinutes.min || windowMinutes > acceptanceWindowMinutes.max) {
    throw new RangeError(`windowMinutes must be an integer from ${acceptanceWindowMinutes.min} to ${acceptanceWindowMinutes.max}`);
  }
  return {
    orderId,
    merchantId,
    state: 'pending',
    receivedAt: received.toISOString(),
    deadline: new Date(received.getTime() + windowMinutes * 60_000).toISOString(),
  };
}

const audit = (acceptance: OrderAcceptance, actorUserId: string | null, action: string, occurredAt: string, details: Record<string, unknown>): AuditEntry => ({
  actorUserId,
  action: `merchant_order:${action}`,
  resourceType: 'merchant_order',
  resourceId: acceptance.orderId,
  occurredAt,
  details: { merchantId: acceptance.merchantId, ...details },
});

export type RespondError = 'forbidden' | 'invalid_decision' | 'already_decided' | 'window_expired' | 'reason_required' | 'invalid_instant';

const deadlinePassed = (acceptance: OrderAcceptance, instant: Date) => {
  const deadline = toInstant(acceptance.deadline);
  return !deadline || instant >= deadline;
};

export function respondToOrder(
  acceptance: OrderAcceptance,
  decision: 'accept' | 'decline',
  principal: Principal,
  at: Date | string,
  reason?: DeclineReason,
): Result<OrderAcceptance, RespondError> {
  const role = matchingRole(principal, acceptance?.merchantId, ['own_staff']);
  if (!role) return { ok: false, error: 'forbidden' };
  if (decision !== 'accept' && decision !== 'decline') return { ok: false, error: 'invalid_decision' };
  if (acceptance?.state !== 'pending') return { ok: false, error: 'already_decided' };
  const instant = toInstant(at);
  if (!instant) return { ok: false, error: 'invalid_instant' };
  if (deadlinePassed(acceptance, instant)) return { ok: false, error: 'window_expired' };
  if (decision === 'decline' && !(declineReasons as readonly string[]).includes(reason ?? '')) return { ok: false, error: 'reason_required' };

  const decidedAt = instant.toISOString();
  const value: OrderAcceptance =
    decision === 'accept'
      ? { ...acceptance, state: 'accepted', decidedAt }
      : { ...acceptance, state: 'declined', decidedAt, declineReason: reason };
  return {
    ok: true,
    value,
    audit: audit(acceptance, principal.userId, decision, decidedAt, {
      actorRole: role,
      ...(decision === 'decline' ? { reason } : {}),
    }),
  };
}

export function expireIfDue(acceptance: OrderAcceptance, now: Date | string): Result<OrderAcceptance, 'not_due' | 'already_decided' | 'invalid_instant'> {
  if (acceptance?.state !== 'pending') return { ok: false, error: 'already_decided' };
  const instant = toInstant(now);
  if (!instant) return { ok: false, error: 'invalid_instant' };
  if (!deadlinePassed(acceptance, instant)) return { ok: false, error: 'not_due' };
  const decidedAt = toInstant(acceptance.deadline)?.toISOString() ?? instant.toISOString();
  return {
    ok: true,
    value: { ...acceptance, state: 'auto_declined', decidedAt, declineReason: 'window_expired' },
    audit: audit(acceptance, null, 'auto_decline', instant.toISOString(), { actorRole: 'system', deadline: acceptance.deadline }),
  };
}
