import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { NativeAuthConfig, NativeAuthPort, TokenSet } from './session';

const storeKey = 'tazumo.auth.session';
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
      return { issuer: document.discoveryDocument?.issuer, endSessionEndpoint: document.endSessionEndpoint, promptValues: Array.isArray(prompts) ? prompts : [] };
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
      return toTokens(await AuthSession.refreshAsync({ clientId: config.clientId, refreshToken }, await discover()));
    },
    async endSession(url) {
      await WebBrowser.openAuthSessionAsync(url, redirectUri);
    },
    async fetchMe(accessToken) {
      const response = await fetch(`${config.apiUrl}/v1/me`, { headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` } });
      return { status: response.status, body: response.ok ? await response.json() : undefined };
    },
    store: {
      read: () => SecureStore.getItemAsync(storeKey),
      write: (value) => SecureStore.setItemAsync(storeKey, value),
      clear: () => SecureStore.deleteItemAsync(storeKey),
    },
    randomNonce: () => Crypto.randomUUID(),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}
