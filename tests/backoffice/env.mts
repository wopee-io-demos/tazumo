const base = Number(process.env.BACKOFFICE_E2E_PORT_BASE ?? 47310);

export const ports = { idp: base + 1, api: base + 2, apiNoAuth: base + 3, preview: base + 4, previewNoAuth: base + 5 };
export const issuer = `http://127.0.0.1:${ports.idp}`;
export const audience = 'tazumo-api-backoffice-e2e';
export const clientId = 'tazumo-backoffice-e2e';
export const previewOrigins = [ports.preview, ports.previewNoAuth].map((p) => `http://127.0.0.1:${p}`);

export const principals: Record<string, string[]> = {
  'bo-admin': ['admin'],
  'bo-support': ['support'],
  'bo-short-session': ['support'],
  'bo-staff-a': ['merchant_staff'],
  'bo-customer': [],
  'bo-target': [],
};
