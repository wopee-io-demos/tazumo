// Real-IdP suite (#87): Keycloak from infra/idp, Mailpit, and the real apps/api server configured only through AUTH_* env.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { audience, clients, oidc, tokenType } from './env.mts';
import { authorizeUrl, callApi, callbackParams, completeSignIn, decode, exchange, watchCallbacks, mailedLink, startSignIn, visit, type Tokens } from './oidc.mts';

test.describe.configure({ mode: 'serial' });

const email = `reg-${randomBytes(6).toString('hex')}@tazumo.test`;
const firstPassword = `First-${randomBytes(12).toString('base64url')}`;
const secondPassword = `Second-${randomBytes(12).toString('base64url')}`;
let registered: Tokens;
let userId: string;

async function signInWithPassword(page: Page, password: string) {
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
}

test('registration on the Keycloak page, e-mail verification, password set after verification, then Authorization Code + PKCE reach GET /v1/me', async ({ page }) => {
  const flow = await startSignIn(page, clients.web);
  await page.getByRole('link', { name: /register/i }).click();
  await page.locator('#email').fill(email);
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Registrant');
  await expect(page.locator('#password')).toHaveCount(0);
  const sent = Date.now() - 2000;
  await page.getByRole('button', { name: /register/i }).click();
  await expect(page.getByText(/verify your email/i).first()).toBeVisible();

  await visit(page, await mailedLink(email, /verify email/i, sent));
  await page.locator('#password-new').fill(firstPassword);
  await page.locator('#password-confirm').fill(firstPassword);
  await page.locator('[type=submit]').click();
  registered = await completeSignIn(page, clients.web, flow);

  const header = decode(registered.access_token, 0);
  const claims = decode(registered.access_token, 1);
  expect(header).toMatchObject({ alg: 'RS256', typ: tokenType });
  expect([claims.aud].flat()).toContain(audience);
  expect(claims.azp).toBe(clients.web.id);
  expect(claims.exp - claims.iat).toBe(300);

  const me = await callApi('/v1/me', registered.access_token);
  expect(me.status).toBe(200);
  const body = await me.json();
  expect(body.roles).toEqual([{ role: 'customer', merchantId: null }]);
  userId = body.userId;
});

test('the API refuses a token for another audience, the ID token and a missing token', async ({ page }) => {
  const flow = await startSignIn(page, clients.probe);
  await signInWithPassword(page, firstPassword);
  const probe = await completeSignIn(page, clients.probe, flow);
  expect(decode(probe.access_token, 0).typ).toBe(tokenType);
  expect([decode(probe.access_token, 1).aud].flat()).not.toContain(audience);

  for (const token of [probe.access_token, registered.id_token]) {
    const response = await callApi('/v1/me', token);
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
  }
  expect((await callApi('/v1/me')).status).toBe(401);
});

test('Keycloak enforces PKCE S256 and refuses the password grant', async ({ page }) => {
  watchCallbacks(page);
  await visit(page, authorizeUrl(clients.web, { state: 'no-pkce' }));
  const refused = await callbackParams(page, clients.web);
  expect(refused.get('error')).toBe('invalid_request');

  const flow = await startSignIn(page, clients.web);
  await signInWithPassword(page, firstPassword);
  const params = await callbackParams(page, clients.web);
  const wrongVerifier = await exchange(clients.web, params.get('code')!, `${flow.verifier}x`);
  expect(wrongVerifier.status).toBe(400);
  expect((await wrongVerifier.json()).error).toBe('invalid_grant');

  const passwordGrant = await fetch(oidc.token, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: clients.web.id, username: email, password: firstPassword }),
  });
  expect(passwordGrant.ok).toBe(false);
  expect((await passwordGrant.json()).error).toBe('unauthorized_client');
});

test('forgot password: the Mailpit reset link sets a new password on the Keycloak page; old fails, new works', async ({ browser }) => {
  const reset = await browser.newPage();
  const flow = await startSignIn(reset, clients.web);
  await reset.getByRole('link', { name: /forgot password/i }).click();
  await reset.locator('#username').fill(email);
  const sent = Date.now() - 2000;
  await reset.locator('[type=submit]').click();
  await expect(reset.getByText(/you should receive an email/i)).toBeVisible();

  await visit(reset, await mailedLink(email, /reset password/i, sent));
  await reset.locator('#password-new').fill(secondPassword);
  await reset.locator('#password-confirm').fill(secondPassword);
  await reset.locator('[type=submit]').click();
  await completeSignIn(reset, clients.web, flow);
  await reset.close();

  const old = await browser.newPage();
  await startSignIn(old, clients.web);
  await signInWithPassword(old, firstPassword);
  await expect(old.getByText(/invalid username or password/i)).toBeVisible();
  await old.close();

  const fresh = await browser.newPage();
  const signIn = await startSignIn(fresh, clients.web);
  await signInWithPassword(fresh, secondPassword);
  const tokens = await completeSignIn(fresh, clients.web, signIn);
  const me = await callApi('/v1/me', tokens.access_token);
  expect(me.status).toBe(200);
  expect((await me.json()).userId).toBe(userId);
  await fresh.close();
});

test('a user seeded with a generated password signs in through the back-office client', async ({ page }) => {
  const users: { name: string; email: string; password: string }[] = JSON.parse(
    readFileSync(join(__dirname, '../../infra/idp/.local/test-users.json'), 'utf8'),
  );
  const customer = users.find((user) => user.name === 'customer')!;
  const flow = await startSignIn(page, clients.backoffice);
  await page.locator('#username').fill(customer.email);
  await page.locator('#password').fill(customer.password);
  await page.locator('#kc-login').click();
  const tokens = await completeSignIn(page, clients.backoffice, flow);
  expect(decode(tokens.access_token, 1).azp).toBe(clients.backoffice.id);
  expect((await callApi('/v1/me', tokens.access_token)).status).toBe(200);
});

test('the registration access token is refused once it has expired', async () => {
  const { exp } = decode(registered.access_token, 1);
  const wait = Math.max(0, exp * 1000 + 61_000 - Date.now());
  test.setTimeout(wait + 30_000);
  await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await callApi('/v1/me', registered.access_token);
  expect(response.status).toBe(401);
  expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
});
