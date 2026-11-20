export const roles = ['customer', 'merchant_staff', 'courier', 'support', 'admin'] as const;
export type Role = (typeof roles)[number];

export type Actor = { userId: string; role: Role; merchantId?: string };

export type AuditEntry = {
  actorUserId: string | null;
  action: string;
  resourceType: 'merchant' | 'merchant_order';
  resourceId: string;
  occurredAt: string;
  details: Record<string, unknown>;
};

export type Result<T, E extends string> = { ok: true; value: T; audit: AuditEntry } | { ok: false; error: E };

export const isStaffOf = (actor: Actor, merchantId: string) =>
  actor.role === 'merchant_staff' && actor.merchantId === merchantId;

export function toInstant(at: Date | string): Date | null {
  const date = typeof at === 'string' ? new Date(at) : at;
  return Number.isNaN(date.getTime()) ? null : date;
}
