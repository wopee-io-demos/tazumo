export const roles = ['customer', 'merchant_staff', 'courier', 'support', 'admin'] as const;
export type Role = (typeof roles)[number];

export type Grant = { role: Role; merchantId: string | null };
export type Principal = { userId: string; grants: Grant[] };

export type AuditEntry = {
  actorUserId: string | null;
  action: string;
  resourceType: 'merchant' | 'merchant_order';
  resourceId: string;
  occurredAt: string;
  details: Record<string, unknown>;
};

export type Result<T, E extends string> = { ok: true; value: T; audit: AuditEntry } | { ok: false; error: E };

export type Rule = 'own_staff' | 'support' | 'admin';

export function matchingRole(principal: Principal, merchantId: string, rules: readonly Rule[]): Role | null {
  const grants = Array.isArray(principal?.grants) ? principal.grants : [];
  for (const rule of rules) {
    const match =
      rule === 'own_staff'
        ? grants.some((g) => g.role === 'merchant_staff' && g.merchantId === merchantId)
        : grants.some((g) => g.role === rule);
    if (match) return rule === 'own_staff' ? 'merchant_staff' : rule;
  }
  return null;
}

const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function toInstant(at: Date | string): Date | null {
  if (typeof at === 'string' && !isoInstant.test(at)) return null;
  const date = typeof at === 'string' ? new Date(at) : at;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}
