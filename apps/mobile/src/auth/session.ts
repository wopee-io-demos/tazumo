// Platform-free native sign-in state machine (ADR-0027). The Expo bindings live in expo.ts.
export type Me = { userId: string; roles: { role: string; merchantId: string | null }[] };
export type Notice = 'signInFailed' | 'signInRefused' | 'sessionEnded' | 'accountUnavailable';
export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'restoring' }
  | { status: 'pending' }
  | { status: 'signing-out' }
  | { status: 'signed-out'; notice?: Notice }
  | { status: 'signed-in'; me: Me; email?: string };

export type NativeAuthConfig = { issuer: string; clientId: string; scope: string; apiUrl: string };
export type TokenSet = { accessToken: string; refreshToken?: string; idToken?: string; expiresIn?: number };
export type Discovery = { issuer?: string; endSessionEndpoint?: string; promptValues: string[]; issParameter: boolean };
export type AuthorizeResult = { type: 'success'; code: string; codeVerifier: string; iss?: string } | { type: 'cancel' } | { type: 'error' };
export type StoreKey = 'refreshToken' | 'idToken';

/** Thrown by `NativeAuthPort.refresh` when the token endpoint refuses the grant, as opposed to a network failure. */
export class RefreshRejected extends Error {}

/** What the state machine needs from the platform: system-browser authorization, the token endpoint and secure storage. */
export type NativeAuthPort = {
  redirectUri: string;
  discover(): Promise<Discovery>;
  authorize(options: { nonce: string; prompt?: 'create' }): Promise<AuthorizeResult>;
  exchange(code: string, codeVerifier: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  endSession(url: string): Promise<void>;
  fetchMe(accessToken: string): Promise<{ status: number; body?: unknown }>;
  store: { get(key: StoreKey): Promise<string | null>; set(key: StoreKey, value: string): Promise<void>; delete(key: StoreKey): Promise<void> };
  randomNonce(): string;
  now(): number;
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

const refreshLeadSeconds = 30;
const retrySeconds = 30;
const clockToleranceSeconds = 60;
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
  return { issuer, clientId, scope: values.scope?.trim() || 'openid', apiUrl: trimSlash(apiUrl) };
}

export function createNativeAuth(config: NativeAuthConfig | null, port: NativeAuthPort | null): NativeAuth {
  let current: AuthState = config && port ? { status: 'restoring' } : { status: 'unconfigured' };
  const listeners = new Set<() => void>();
  const set = (next: AuthState) => {
    if (next === current) return;
    current = next;
    listeners.forEach((listener) => listener());
  };
  let access: string | null = null;
  let refreshToken: string | null = null;
  let idToken: string | null = null;
  let timer: unknown;
  let generation = 0;
  let started: Promise<void> | null = null;
  let storage: Promise<unknown> = Promise.resolve();
  /** Secure-store operations run one at a time, so a write from an older session can never land after a sign-out's deletes. */
  const queued = (op: () => Promise<unknown>) => (storage = storage.then(op, op).catch(() => undefined));
  const forgetStored = () => queued(() => Promise.all((['refreshToken', 'idToken'] as const).map((key) => port!.store.delete(key))));

  /** Drops the in-memory session. `forget` also deletes the stored tokens; network failures keep them for the next start. */
  const leave = async (next: AuthState, forget: boolean) => {
    generation++;
    port!.clearTimer(timer);
    access = null;
    if (forget) {
      refreshToken = idToken = null;
      await forgetStored();
    }
    set(next);
  };
  const endSession = (notice?: Notice) => leave({ status: 'signed-out', notice }, true);

  async function accept(tokens: TokenSet) {
    const turn = generation;
    access = tokens.accessToken;
    refreshToken = tokens.refreshToken ?? refreshToken;
    idToken = tokens.idToken ?? idToken;
    for (const key of ['refreshToken', 'idToken'] as const) {
      const value = tokens[key];
      if (value) await queued(() => (turn === generation ? port!.store.set(key, value) : Promise.resolve()));
    }
    if (turn === generation) schedule(tokens.expiresIn ? Math.max(5, tokens.expiresIn - refreshLeadSeconds) : undefined);
  }

  function schedule(seconds?: number) {
    port!.clearTimer(timer);
    if (refreshToken && seconds) timer = port!.setTimer(refresh, seconds * 1000);
  }

  async function refresh() {
    const turn = generation;
    try {
      const tokens = await port!.refresh(refreshToken!);
      if (turn === generation) await accept(tokens);
    } catch (error) {
      if (turn !== generation) return;
      if (error instanceof RefreshRejected) await endSession('sessionEnded');
      else schedule(retrySeconds);
    }
  }

  async function loadAccount(email?: string) {
    const turn = generation;
    const response = await port!.fetchMe(access!).catch(() => ({ status: 0, body: undefined }));
    if (turn !== generation) return;
    if (response.status === 401) return endSession('sessionEnded');
    if (response.status !== 200 || !response.body) return leave({ status: 'signed-out', notice: 'accountUnavailable' }, false);
    set({ status: 'signed-in', me: response.body as Me, email });
  }

  function verifiedEmail(tokens: TokenSet, nonce: string) {
    if (!tokens.idToken) throw new Error('no ID token');
    const claims = jwtClaims(tokens.idToken);
    const audience = [claims.aud].flat();
    const fresh = typeof claims.exp === 'number' && claims.exp > port!.now() / 1000 - clockToleranceSeconds;
    if (claims.nonce !== nonce || claims.iss !== config!.issuer || !audience.includes(config!.clientId) || !fresh) throw new Error('ID token rejected');
    return typeof claims.email === 'string' ? claims.email : undefined;
  }

  const storedEmail = () => {
    try {
      const email = idToken ? jwtClaims(idToken).email : undefined;
      return typeof email === 'string' ? email : undefined;
    } catch {
      return undefined;
    }
  };

  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      return (started ??= (async () => {
        if (!config || !port) return;
        [refreshToken, idToken] = await Promise.all([port.store.get('refreshToken'), port.store.get('idToken')]).catch(() => [null, null]);
        if (!refreshToken) return set({ status: 'signed-out' });
        try {
          await accept(await port.refresh(refreshToken));
        } catch (error) {
          return error instanceof RefreshRejected ? endSession('sessionEnded') : leave({ status: 'signed-out', notice: 'accountUnavailable' }, false);
        }
        await loadAccount(storedEmail());
      })());
    },
    async signIn(mode) {
      if (!config || !port || current.status === 'pending' || current.status === 'signing-out') return;
      set({ status: 'pending' });
      try {
        const discovery = await port.discover();
        if (discovery.issuer !== config.issuer) throw new Error('issuer mismatch');
        const nonce = port.randomNonce();
        const result = await port.authorize({ nonce, ...(mode === 'sign-up' && discovery.promptValues.includes('create') ? { prompt: 'create' as const } : {}) });
        if (result.type === 'cancel') return set({ status: 'signed-out' });
        if (result.type === 'error') return endSession('signInRefused');
        if ((result.iss !== undefined || discovery.issParameter) && result.iss !== config.issuer) throw new Error('iss mismatch');
        const tokens = await port.exchange(result.code, result.codeVerifier);
        const email = verifiedEmail(tokens, nonce);
        await accept(tokens);
        await loadAccount(email);
      } catch {
        await endSession('signInFailed');
      }
    },
    async signOut() {
      if (!config || !port || current.status !== 'signed-in') return;
      const hint = idToken;
      set({ status: 'signing-out' });
      await leave(current, true);
      try {
        const { endSessionEndpoint } = await port.discover();
        if (endSessionEndpoint) {
          const params = { client_id: config.clientId, post_logout_redirect_uri: port.redirectUri, ...(hint ? { id_token_hint: hint } : {}) };
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
