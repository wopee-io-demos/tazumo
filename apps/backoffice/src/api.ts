import type { AuthProvider } from './auth.ts';

export type Role = 'customer' | 'merchant_staff' | 'courier' | 'support' | 'admin';
export type Grant = { role: Role; merchantId: string | null };
export type Me = { userId: string; roles: Grant[] };
export type Merchant = { id: string; name: string; marketCode: string };
export type StaffMember = { userId: string; role: Role };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Api = (<T>(path: string, init?: RequestInit) => Promise<T>) & {
  status: (path: string, init?: RequestInit) => Promise<number>;
};

export function createApi(auth: AuthProvider, onUnauthorized: () => void): Api {
  async function send(path: string, init: RequestInit) {
    const token = auth.accessToken();
    const response = await fetch(path, {
      ...init,
      headers: { accept: 'application/json', ...init.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (response.status === 401 && path !== '/v1/me') onUnauthorized();
    const body = response.status === 204 ? undefined : await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, body?.code ?? 'error', body?.message ?? response.statusText);
    return { status: response.status, body };
  }
  const api = (async (path: string, init: RequestInit = {}) => (await send(path, init)).body) as Api;
  api.status = async (path, init = {}) => (await send(path, init)).status;
  return api;
}

export async function loadMerchants(api: Api): Promise<Merchant[]> {
  const markets = await api<{ code: string }[]>('/v1/markets');
  const lists = await Promise.all(
    markets.map((m) => api<Merchant[]>(`/v1/merchants?marketCode=${encodeURIComponent(m.code)}`)),
  );
  return lists.flat();
}

export const backOfficeRoles: Role[] = ['merchant_staff', 'support', 'admin'];
export const hasRole = (me: Me, role: Role) => me.roles.some((g) => g.role === role);
export const staffMerchantIds = (me: Me) =>
  me.roles.filter((g) => g.role === 'merchant_staff' && g.merchantId).map((g) => g.merchantId as string);
