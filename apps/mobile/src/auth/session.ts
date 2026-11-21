// Platform-free native sign-in state machine (ADR-0027). The Expo bindings live in expo.ts.
export type Me = { userId: string; roles: { role: string; merchantId: string | null }[] };
export type Notice = 'signInFailed' | 'signInRefused' | 'sessionEnded' | 'accountUnavailable';
export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'pending' }
  | { status: 'signing-out' }
  | { status: 'signed-out'; notice?: Notice }
  | { status: 'signed-in'; me: Me; email?: string };

export type NativeAuthConfig = { issuer: string; clientId: string; scope: string; apiUrl: string };
export type TokenSet = { accessToken: string; refreshToken?: string; idToken?: string; expiresIn?: number };
export type Discovery = { issuer?: string; endSessionEndpoint?: string; promptValues: string[] };
export type AuthorizeResult = { type: 'success'; code: string; codeVerifier: string; iss?: string } | { type: 'cancel' } | { type: 'error' };

/** What the state machine needs from the platform: system-browser authorization, the token endpoint and secure storage. */
export type NativeAuthPort = {
  redirectUri: string;
  discover(): Promise<Discovery>;
  authorize(options: { nonce: string; prompt?: 'create' }): Promise<AuthorizeResult>;
  exchange(code: string, codeVerifier: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  endSession(url: string): Promise<void>;
  fetchMe(accessToken: string): Promise<{ status: number; body?: unknown }>;
  store: { read(): Promise<string | null>; write(value: string): Promise<void>; clear(): Promise<void> };
  randomNonce(): string;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
};

export type NativeAuth = {
  state(): AuthState;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  signIn(mode: 'sign-in' | 'sign-up'): Promise<void>;
  signOut(): Promise<void>;
};

type Stored = { refreshToken: string; idToken?: string };
const refreshLeadSeconds = 30;
const trimSlash = (url: string) => url.replace(/\/+$/, '');

/** Claims of a JWT received directly from the token endpoint over TLS (OIDC Core 3.1.3.7 allows TLS instead of a signature check). */
export function jwtClaims(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1] ?? '';
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function parseNativeAuthConfig(values: { issuer?: string; clientId?: string; scope?: string; apiUrl?: string }): NativeAuthConfig | null {
  const issuer = values.issuer?.trim(), clientId = values.clientId?.trim(), apiUrl = values.apiUrl?.trim();
  if (!issuer || !clientId || !apiUrl) return null;
  return { issuer: trimSlash(issuer), clientId, scope: values.scope?.trim() || 'openid', apiUrl: trimSlash(apiUrl) };
}

export function createNativeAuth(config: NativeAuthConfig | null, port: NativeAuthPort | null): NativeAuth {
  let current: AuthState = config && port ? { status: 'pending' } : { status: 'unconfigured' };
  const listeners = new Set<() => void>();
  const set = (next: AuthState) => {
    current = next;
    listeners.forEach((listener) => listener());
  };
  let access: string | null = null;
  let stored: Stored | null = null;
  let timer: unknown;
  let generation = 0;
  let started: Promise<void> | null = null;

  const endSession = async (notice?: Notice, next: AuthState = { status: 'signed-out', notice }) => {
    generation++;
    port!.clearTimer(timer);
    access = null;
    stored = null;
    await port!.store.clear().catch(() => undefined);
    set(next);
  };

  async function accept(tokens: TokenSet) {
    access = tokens.accessToken;
    stored = tokens.refreshToken ? { refreshToken: tokens.refreshToken, idToken: tokens.idToken ?? stored?.idToken } : stored;
    if (stored) await port!.store.write(JSON.stringify(stored));
    port!.clearTimer(timer);
    if (stored && tokens.expiresIn) timer = port!.setTimer(refresh, Math.max(5, tokens.expiresIn - refreshLeadSeconds) * 1000);
  }

  async function refresh() {
    const turn = generation;
    try {
      const tokens = await port!.refresh(stored!.refreshToken);
      if (turn === generation) await accept(tokens);
    } catch {
      if (turn === generation) await endSession('sessionEnded');
    }
  }

  async function loadAccount(email?: string) {
    const turn = generation;
    const response = await port!.fetchMe(access!);
    if (turn !== generation) return;
    if (response.status === 401) return endSession('sessionEnded');
    if (response.status !== 200 || !response.body) return endSession('accountUnavailable');
    set({ status: 'signed-in', me: response.body as Me, email });
  }

  async function verifiedEmail(tokens: TokenSet, nonce: string) {
    if (!tokens.idToken) throw new Error('no ID token');
    const claims = jwtClaims(tokens.idToken);
    const audience = [claims.aud].flat();
    if (claims.nonce !== nonce || trimSlash(String(claims.iss)) !== config!.issuer || !audience.includes(config!.clientId)) throw new Error('ID token rejected');
    return typeof claims.email === 'string' ? claims.email : undefined;
  }

  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      return (started ??= (async () => {
        if (!config || !port) return;
        const saved = await port.store.read().catch(() => null);
        if (!saved) return set({ status: 'signed-out' });
        try {
          stored = JSON.parse(saved) as Stored;
          await accept(await port.refresh(stored.refreshToken));
          await loadAccount(stored?.idToken ? (jwtClaims(stored.idToken).email as string | undefined) : undefined);
        } catch {
          await endSession('sessionEnded');
        }
      })());
    },
    async signIn(mode) {
      if (!config || !port) return;
      set({ status: 'pending' });
      try {
        const discovery = await port.discover();
        if (trimSlash(discovery.issuer ?? '') !== config.issuer) throw new Error('issuer mismatch');
        const nonce = port.randomNonce();
        const result = await port.authorize({ nonce, ...(mode === 'sign-up' && discovery.promptValues.includes('create') ? { prompt: 'create' as const } : {}) });
        if (result.type === 'cancel') return set({ status: 'signed-out' });
        if (result.type === 'error') return endSession('signInRefused');
        if (result.iss !== undefined && trimSlash(result.iss) !== config.issuer) throw new Error('iss mismatch');
        const tokens = await port.exchange(result.code, result.codeVerifier);
        const email = await verifiedEmail(tokens, nonce);
        await accept(tokens);
        await loadAccount(email);
      } catch {
        await endSession('signInFailed');
      }
    },
    async signOut() {
      if (!config || !port) return;
      const idToken = stored?.idToken;
      await endSession(undefined, { status: 'signing-out' });
      try {
        const { endSessionEndpoint } = await port.discover();
        if (endSessionEndpoint) {
          const params = { client_id: config.clientId, post_logout_redirect_uri: port.redirectUri, ...(idToken ? { id_token_hint: idToken } : {}) };
          const query = Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
          await port.endSession(`${endSessionEndpoint}${endSessionEndpoint.includes('?') ? '&' : '?'}${query}`);
        }
      } catch {
        // Local sign-out has happened; only the provider session may survive (ADR-0027).
      }
      set({ status: 'signed-out' });
    },
  };
}
