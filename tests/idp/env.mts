const idpBase = `http://127.0.0.1:${process.env.IDP_PORT ?? 48180}`;

export const issuer = `${idpBase}/realms/tazumo`;
export const oidc = {
  authorize: `${issuer}/protocol/openid-connect/auth`,
  token: `${issuer}/protocol/openid-connect/token`,
  jwks: `${issuer}/protocol/openid-connect/certs`,
};
export const mailpit = `http://127.0.0.1:${process.env.IDP_MAIL_PORT ?? 48125}`;
export const apiBase = `http://127.0.0.1:${process.env.IDP_API_PORT ?? 48190}`;
export const audience = 'tazumo-api';
export const tokenType = 'at+jwt';
export const clients = {
  web: { id: 'tazumo-web', redirectUri: 'http://127.0.0.1:5173/auth/callback' },
  backoffice: { id: 'tazumo-backoffice', redirectUri: 'http://127.0.0.1:4174/' },
  probe: { id: 'tazumo-audience-probe', redirectUri: 'http://127.0.0.1:5173/auth/callback' },
};
