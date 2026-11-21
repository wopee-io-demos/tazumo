export type AuthConfig = { issuer: string; clientId: string; scope: string; redirectUri: string };

/** Build-time OIDC settings. Without an issuer and a client ID the build has no sign-in. */
export function authConfig(env: ImportMetaEnv = import.meta.env): AuthConfig | null {
  const issuer = env.VITE_OIDC_ISSUER?.trim();
  const clientId = env.VITE_OIDC_CLIENT_ID?.trim();
  if (!issuer || !clientId) return null;
  return { issuer, clientId, scope: env.VITE_OIDC_SCOPE?.trim() || 'openid', redirectUri: new URL(env.BASE_URL, location.origin).href };
}
