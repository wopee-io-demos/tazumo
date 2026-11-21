import * as oauth from 'oauth4webapi';
import type { AuthConfig } from './config.ts';

export type Me = { userId: string; roles: { role: string; merchantId: string | null }[] };
export type Notice = 'signInFailed' | 'signInRefused' | 'sessionEnded' | 'accountUnavailable';
export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'pending' }
  | { status: 'signing-out' }
  | { status: 'signed-out'; notice?: Notice }
  | { status: 'signed-in'; me: Me; email?: string };

type Tokens = { access: string; refresh?: string; idToken?: string };
type Transaction = { state: string; nonce: string; verifier: string; returnTo: string };

const transactionKey = 'tazumo.web.signin';
const refreshLeadSeconds = 30;
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export type Auth = {
  state(): AuthState;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  signIn(mode: 'sign-in' | 'sign-up'): Promise<void>;
  signOut(): Promise<void>;
};

/**
 * OIDC Authorization Code + PKCE (S256) with state and nonce, endpoints from the issuer's discovery document.
 * Tokens live only in this closure. sessionStorage holds the transaction (state, nonce, verifier) across the redirect.
 */
export function createAuth(config: AuthConfig | null): Auth {
  let current: AuthState = config ? { status: 'pending' } : { status: 'unconfigured' };
  const listeners = new Set<() => void>();
  const set = (next: AuthState) => {
    current = next;
    listeners.forEach((listener) => listener());
  };
  let tokens: Tokens | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let started: Promise<void> | null = null;
  let server: Promise<oauth.AuthorizationServer> | null = null;
  let generation = 0;

  const issuer = config && new URL(config.issuer);
  const client: oauth.Client = { client_id: config?.clientId ?? '' };
  const http = { [oauth.allowInsecureRequests]: issuer?.protocol === 'http:' && loopbackHosts.has(issuer.hostname) };
  const discover = () =>
    (server ??= oauth
      .discoveryRequest(issuer!, http)
      .then((response) => oauth.processDiscoveryResponse(issuer!, response))
      .catch((error) => {
        server = null;
        throw error;
      }));

  const endSession = (notice?: Notice, next: AuthState = { status: 'signed-out', notice }) => {
    generation++;
    clearTimeout(refreshTimer);
    tokens = null;
    set(next);
  };

  const accept = (result: oauth.TokenEndpointResponse) => {
    tokens = { access: result.access_token, refresh: result.refresh_token ?? tokens?.refresh, idToken: result.id_token ?? tokens?.idToken };
    clearTimeout(refreshTimer);
    if (tokens.refresh && result.expires_in) refreshTimer = setTimeout(refresh, Math.max(5, result.expires_in - refreshLeadSeconds) * 1000);
  };

  async function refresh() {
    const turn = generation;
    try {
      const as = await discover();
      const response = await oauth.refreshTokenGrantRequest(as, client, oauth.None(), tokens!.refresh!, http);
      const result = await oauth.processRefreshTokenResponse(as, client, response);
      if (turn === generation) accept(result);
    } catch {
      if (turn === generation) endSession('sessionEnded');
    }
  }

  async function loadAccount(email?: string) {
    const response = await fetch('/v1/me', { headers: { accept: 'application/json', authorization: `Bearer ${tokens!.access}` } });
    if (response.status === 401) return endSession('sessionEnded');
    if (!response.ok) return endSession('accountUnavailable');
    set({ status: 'signed-in', me: (await response.json()) as Me, email });
  }

  async function completeSignIn(url: URL) {
    const stored = sessionStorage.getItem(transactionKey);
    sessionStorage.removeItem(transactionKey);
    const transaction = stored ? (JSON.parse(stored) as Transaction) : null;
    history.replaceState(null, '', `${url.pathname}${transaction?.returnTo ?? ''}`);
    if (!transaction) return endSession('signInFailed');
    try {
      const as = await discover();
      const params = oauth.validateAuthResponse(as, client, url, transaction.state);
      const response = await oauth.authorizationCodeGrantRequest(as, client, oauth.None(), params, config!.redirectUri, transaction.verifier, http);
      const result = await oauth.processAuthorizationCodeResponse(as, client, response, { expectedNonce: transaction.nonce, requireIdToken: true });
      accept(result);
      const email = oauth.getValidatedIdTokenClaims(result)?.email;
      await loadAccount(typeof email === 'string' ? email : undefined);
    } catch (error) {
      endSession(error instanceof oauth.AuthorizationResponseError ? 'signInRefused' : 'signInFailed');
    }
  }

  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      return (started ??= (async () => {
        if (!config) return;
        const url = new URL(location.href);
        const callback = url.pathname === new URL(config.redirectUri).pathname && (url.searchParams.has('code') || url.searchParams.has('error'));
        if (callback) await completeSignIn(url);
        else set({ status: 'signed-out' });
      })());
    },
    async signIn(mode) {
      if (!config) return;
      try {
        const as = await discover();
        const transaction: Transaction = {
          state: oauth.generateRandomState(),
          nonce: oauth.generateRandomNonce(),
          verifier: oauth.generateRandomCodeVerifier(),
          returnTo: location.hash,
        };
        const url = new URL(as.authorization_endpoint!);
        url.search = new URLSearchParams({
          response_type: 'code',
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scope,
          state: transaction.state,
          nonce: transaction.nonce,
          code_challenge: await oauth.calculatePKCECodeChallenge(transaction.verifier),
          code_challenge_method: 'S256',
          ...(mode === 'sign-up' && Array.isArray(as.prompt_values_supported) && as.prompt_values_supported.includes('create') ? { prompt: 'create' } : {}),
        }).toString();
        sessionStorage.setItem(transactionKey, JSON.stringify(transaction));
        location.assign(url.href);
      } catch {
        endSession('signInFailed');
      }
    },
    async signOut() {
      const idToken = tokens?.idToken;
      endSession(undefined, { status: 'signing-out' });
      const as = await discover().catch(() => null);
      if (!config || !as?.end_session_endpoint) return set({ status: 'signed-out' });
      const url = new URL(as.end_session_endpoint);
      url.search = new URLSearchParams({
        client_id: config.clientId,
        post_logout_redirect_uri: config.redirectUri,
        ...(idToken ? { id_token_hint: idToken } : {}),
      }).toString();
      location.assign(url.href);
    },
  };
}
