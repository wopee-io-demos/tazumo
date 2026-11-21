export interface AuthProvider {
  /** Finishes a redirect sign-in if the URL carries one. Returns true when a session was established. */
  completeSignIn(): Promise<boolean>;
  signIn(returnTo: string): Promise<void>;
  signOut(): void;
  accessToken(): string | null;
}

export type OidcConfig = { issuer: string; clientId: string; scope: string; resource?: string };

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string };
type Transaction = { state: string; verifier: string; returnTo: string };

export class AuthError extends Error {}

const transactionKey = 'tazumo.backoffice.pkce';
const trimSlash = (url: string) => url.replace(/\/+$/, '');

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const randomString = (length: number) => base64url(crypto.getRandomValues(new Uint8Array(length)));

/** OIDC Authorization Code flow with PKCE (S256). The access token is held in memory only. */
export function createOidcProvider(config: OidcConfig): AuthProvider {
  let session: { token: string; expiresAt: number } | null = null;
  let discovery: Promise<Discovery> | null = null;
  const redirectUri = () => `${location.origin}${location.pathname}`;

  const discover = () =>
    (discovery ??= fetch(`${trimSlash(config.issuer)}/.well-known/openid-configuration`).then(async (response) => {
      if (!response.ok) throw new AuthError('The sign-in provider is unavailable.');
      const document = (await response.json()) as Discovery;
      if (trimSlash(document.issuer) !== trimSlash(config.issuer)) throw new AuthError('The sign-in provider is misconfigured.');
      return document;
    }));

  return {
    async signIn(returnTo) {
      const { authorization_endpoint } = await discover();
      const transaction: Transaction = { state: randomString(16), verifier: randomString(32), returnTo };
      const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transaction.verifier)));
      sessionStorage.setItem(transactionKey, JSON.stringify(transaction));
      const url = new URL(authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri(),
        scope: config.scope,
        state: transaction.state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        ...(config.resource ? { resource: config.resource } : {}),
      }).toString();
      location.assign(url.toString());
    },

    async completeSignIn() {
      const params = new URLSearchParams(location.search);
      if (!params.has('code') && !params.has('error')) return false;
      const stored = sessionStorage.getItem(transactionKey);
      sessionStorage.removeItem(transactionKey);
      const transaction = stored ? (JSON.parse(stored) as Transaction) : null;
      history.replaceState(null, '', `${location.pathname}${transaction?.returnTo ?? '#/'}`);
      if (params.has('error')) throw new AuthError('Sign-in was cancelled or refused.');
      if (!transaction || params.get('state') !== transaction.state) throw new AuthError('Sign-in could not be verified. Please try again.');

      const { token_endpoint } = await discover();
      const response = await fetch(token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: params.get('code')!,
          redirect_uri: redirectUri(),
          client_id: config.clientId,
          code_verifier: transaction.verifier,
        }),
      });
      if (!response.ok) throw new AuthError('Sign-in could not be completed. Please try again.');
      const body = (await response.json()) as { access_token?: string; expires_in?: number };
      if (!body.access_token) throw new AuthError('Sign-in could not be completed. Please try again.');
      session = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 };
      return true;
    },

    signOut() {
      session = null;
    },

    accessToken() {
      if (session && session.expiresAt <= Date.now()) session = null;
      return session?.token ?? null;
    },
  };
}
