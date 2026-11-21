export const roles = ['customer', 'merchant_staff', 'courier', 'support', 'admin'] as const;
export type Role = (typeof roles)[number];
export type Grant = { role: Role; merchantId: string | null };
export type Principal = { userId: string; grants: Grant[] };

export type Action = 'user:read' | 'merchant_staff:list' | 'role:manage' | 'user:erase';
export type Resource = { type: 'user'; id: string } | { type: 'merchant'; id: string; exists: boolean };

export type Decision = { allowed: true; audit: boolean } | { allowed: false; status: 403 | 404 };

const has = (principal: Principal, role: Role) => principal.grants.some((g) => g.role === role);
export const isPrivileged = (principal: Principal) => has(principal, 'support') || has(principal, 'admin');
const isStaff = (principal: Principal) => principal.grants.some((g) => ['merchant_staff', 'support', 'admin'].includes(g.role));

function deny(principal: Principal, resourceExists: boolean): Decision {
  return { allowed: false, status: isStaff(principal) && resourceExists ? 403 : 404 };
}

export function can(principal: Principal, action: Action, resource: Resource): Decision {
  switch (action) {
    case 'user:read':
      if (resource.type !== 'user') return deny(principal, false);
      if (resource.id === principal.userId) return { allowed: true, audit: false };
      if (isPrivileged(principal)) return { allowed: true, audit: true };
      return deny(principal, true);
    case 'user:erase':
      if (resource.type !== 'user') return { allowed: false, status: 403 };
      if (resource.id === principal.userId) return { allowed: true, audit: true };
      if (isPrivileged(principal)) return { allowed: true, audit: true };
      return { allowed: false, status: 403 };
    case 'role:manage':
      if (!has(principal, 'admin') || resource.type !== 'user' || resource.id === principal.userId) {
        return { allowed: false, status: 403 };
      }
      return { allowed: true, audit: true };
    case 'merchant_staff:list':
      if (resource.type !== 'merchant' || !resource.exists) return deny(principal, false);
      if (principal.grants.some((g) => g.role === 'merchant_staff' && g.merchantId === resource.id)) {
        return { allowed: true, audit: false };
      }
      if (isPrivileged(principal)) return { allowed: true, audit: true };
      return deny(principal, true);
  }
}
