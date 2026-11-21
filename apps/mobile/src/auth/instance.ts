import { createExpoPort } from './expo';
import { createNativeAuth, parseNativeAuthConfig } from './session';

const config = parseNativeAuthConfig({
  issuer: process.env.EXPO_PUBLIC_OIDC_ISSUER,
  clientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID,
  scope: process.env.EXPO_PUBLIC_OIDC_SCOPE,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
});

export const nativeAuth = createNativeAuth(config, config && createExpoPort(config));
