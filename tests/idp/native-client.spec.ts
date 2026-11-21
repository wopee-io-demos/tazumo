// The native client (#88 slice 2) against the real realm: what apps/mobile does through expo-auth-session, at protocol level.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { audience, clients, issuer, oidc, tokenType } from './env.mts';
import { authorizeUrl, callApi, decode, exchange, pkce, type Tokens } from './oidc.mts';

const app = clients.native;
const endSession = `${issuer}/protocol/openid-connect/logout`;
const customer = () =>
  (JSON.parse(readFileSync(join(__dirname, '../../infra/idp/.local/test-users.json'), 'utf8')) as { name: string; email: string; password: string }[]).find(
    (user) => user.name === 'customer',
  )!;

/** Keycloak answers with a redirect to the app scheme, which a browser cannot follow; capture it and end the navigation. */
async function captureRedirect(page: Page, prefix: string, startsWith: string) {
  const captured: { location?: string } = {};
  await page.route((url) => url.href.startsWith(prefix), async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers().location ?? '';
    if (!location.startsWith(startsWith)) return route.fulfill({ response });
    captured.location = location;
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Returned to the app</title>' });
  });
  return captured;
}

test('the native client signs in on tazumo://auth/callback with PKCE and nonce; refresh and RP-initiated logout use the same redirect', async ({ page }) => {
  const user = customer();
  const flow = pkce();
  const nonce = randomBytes(16).toString('base64url');
  const login = await captureRedirect(page, `${issuer}/login-actions/authenticate`, app.redirectUri);
  await page.goto(authorizeUrl(app, { state: flow.state, nonce, code_challenge: flow.challenge, code_challenge_method: 'S256' }));
  await page.locator('#username').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('#kc-login').click();
  await expect.poll(() => login.location).toBeTruthy();

  const callback = new URL(login.location!);
  expect(callback.searchParams.get('state')).toBe(flow.state);
  expect(callback.searchParams.get('iss')).toBe(issuer);
  const response = await exchange(app, callback.searchParams.get('code')!, flow.verifier);
  expect(response.status).toBe(200);
  const tokens: Tokens & { refresh_token: string } = await response.json();
  expect(decode(tokens.access_token, 0).typ).toBe(tokenType);
  expect([decode(tokens.access_token, 1).aud].flat()).toContain(audience);
  expect(decode(tokens.access_token, 1).azp).toBe(app.id);
  expect(decode(tokens.id_token, 1)).toMatchObject({ iss: issuer, aud: app.id, nonce });
  expect((await callApi('/v1/me', tokens.access_token)).status).toBe(200);

  const refreshed = await fetch(oidc.token, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: app.id, refresh_token: tokens.refresh_token }),
  });
  expect(refreshed.status).toBe(200);
  expect((await callApi('/v1/me', (await refreshed.json()).access_token)).status).toBe(200);

  const logout = await captureRedirect(page, endSession, app.redirectUri);
  const url = new URL(endSession);
  url.search = new URLSearchParams({ client_id: app.id, post_logout_redirect_uri: app.redirectUri, id_token_hint: tokens.id_token }).toString();
  await page.goto(url.href);
  await expect.poll(() => logout.location).toBeTruthy();
  expect(logout.location!.startsWith(app.redirectUri)).toBe(true);
});

test('the native client refuses another path on the app scheme, for sign-in and for logout', async ({ page }) => {
  await page.goto(authorizeUrl(app, { state: 's', code_challenge: pkce().challenge, code_challenge_method: 'S256', redirect_uri: 'tazumo://evil' }));
  await expect(page.getByText(/invalid parameter: redirect_uri/i)).toBeVisible();

  const logout = await captureRedirect(page, endSession, 'tazumo://');
  const url = new URL(endSession);
  url.search = new URLSearchParams({ client_id: app.id, post_logout_redirect_uri: 'tazumo://evil' }).toString();
  await page.goto(url.href);
  await expect(page.getByText(/invalid redirect uri/i)).toBeVisible();
  expect(logout.location).toBeUndefined();
});
