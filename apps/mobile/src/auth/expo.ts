import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { RefreshRejected, type NativeAuthConfig, type NativeAuthPort, type StoreKey, type TokenSet } from './session';

/** Token-endpoint errors that mean the grant itself is no longer valid; anything else (`unknown_error`, `temporarily_unavailable`) is treated like a network failure. */
const refusals = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);
const storeKeys: Record<StoreKey, string> = { refreshToken: 'tazumo.auth.refresh', idToken: 'tazumo.auth.id' };
const toTokens = (response: AuthSession.TokenResponse): TokenSet => ({
  accessToken: response.accessToken,
  refreshToken: response.refreshToken,
  idToken: response.idToken,
  expiresIn: response.expiresIn,
});

/** expo-auth-session in the system browser (ASWebAuthenticationSession, Custom Tabs) with PKCE; tokens in expo-secure-store. */
export function createExpoPort(config: NativeAuthConfig): NativeAuthPort {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'tazumo', path: 'auth/callback' });
  let discovery: Promise<AuthSession.DiscoveryDocument> | null = null;
  const discover = () =>
    (discovery ??= AuthSession.fetchDiscoveryAsync(config.issuer).catch((error) => {
      discovery = null;
      throw error;
    }));

  return {
    redirectUri,
    async discover() {
      const document = await discover();
      const prompts = document.discoveryDocument?.prompt_values_supported;
      return {
        issuer: document.discoveryDocument?.issuer,
        endSessionEndpoint: document.endSessionEndpoint,
        promptValues: Array.isArray(prompts) ? prompts : [],
        issParameter: document.discoveryDocument?.authorization_response_iss_parameter_supported === true,
      };
    },
    async authorize({ nonce, prompt }) {
      const request = new AuthSession.AuthRequest({
        clientId: config.clientId,
        redirectUri,
        scopes: config.scope.split(' '),
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: { nonce, ...(prompt ? { prompt } : {}) },
      });
      const result = await request.promptAsync(await discover());
      if (result.type === 'success' && result.params.code && request.codeVerifier) {
        return { type: 'success', code: result.params.code, codeVerifier: request.codeVerifier, iss: result.params.iss };
      }
      return result.type === 'error' || result.type === 'success' ? { type: 'error' } : { type: 'cancel' };
    },
    async exchange(code, codeVerifier) {
      return toTokens(await AuthSession.exchangeCodeAsync({ clientId: config.clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } }, await discover()));
    },
    async refresh(refreshToken) {
      try {
        return toTokens(await AuthSession.refreshAsync({ clientId: config.clientId, refreshToken }, await discover()));
      } catch (error) {
        throw error instanceof AuthSession.TokenError && refusals.has(error.code) ? new RefreshRejected(error.code) : error;
      }
    },
    async endSession(url) {
      await WebBrowser.openAuthSessionAsync(url, redirectUri);
    },
    async fetchMe(accessToken) {
      const response = await fetch(`${config.apiUrl}/v1/me`, { headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` } });
      return { status: response.status, body: response.ok ? await response.json() : undefined };
    },
    store: {
      get: (key) => SecureStore.getItemAsync(storeKeys[key]),
      set: (key, value) => SecureStore.setItemAsync(storeKeys[key], value),
      delete: (key) => SecureStore.deleteItemAsync(storeKeys[key]),
    },
    randomNonce: () => Crypto.randomUUID(),
    now: () => Date.now(),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}
