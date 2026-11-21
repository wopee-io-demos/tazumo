// Web sign-in (#88) against the real Keycloak realm from infra/idp, Mailpit and the real apps/api server.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page, type Route } from '@playwright/test';
import { issuer, oidc } from '../idp/env.mts';
import { mailedLink } from '../idp/oidc.mts';
import { webApp, webClientId } from './env.mts';

test.describe.configure({ mode: 'serial' });

const email = `web-${randomBytes(6).toString('hex')}@tazumo.test`;
const firstPassword = `First-${randomBytes(12).toString('base64url')}`;
const secondPassword = `Second-${randomBytes(12).toString('base64url')}`;
const jwt = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;
let userId: string;

type Watched = { page: Page; tokens: string[]; console: string[]; meCalls: number; tokenCalls: number; expiresIn: number };

async function open(browser: Browser, setup?: (page: Page) => Promise<void>): Promise<Watched> {
  const page = await (await browser.newContext()).newPage();
  const watched: Watched = { page, tokens: [], console: [], meCalls: 0, tokenCalls: 0, expiresIn: 0 };
  page.on('console', (message) => watched.console.push(message.text()));
  page.on('request', (request) => {
    if (request.url() === new URL('/v1/me', webApp).href) watched.meCalls++;
    if (request.url() === oidc.token) watched.tokenCalls++;
  });
  page.on('response', async (response) => {
    if (response.url() !== oidc.token || !response.ok()) return;
    const body = await response.json();
    watched.expiresIn = body.expires_in;
    watched.tokens.push(...['access_token', 'refresh_token', 'id_token'].map((key) => body[key]).filter(Boolean));
  });
  await setup?.(page);
  await page.goto(webApp);
  return watched;
}

async function expectNoTokenLeak({ page, tokens, console }: Watched, onTazumo = true) {
  expect(tokens.length).toBeGreaterThan(0);
  const storage = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
  expect(storage).not.toMatch(jwt);
  expect(page.url()).not.toMatch(/[?&](code|state|session_state|iss)=/);
  for (const token of tokens) {
    expect(storage).not.toContain(token);
    expect(page.url()).not.toContain(token);
    expect(console.join('\n')).not.toContain(token);
  }
  if (onTazumo) await expect(page.locator('input[type=password]')).toHaveCount(0);
}

async function fillLogin(page: Page, user: string, password: string) {
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
}

async function expectSignedIn(page: Page, user: string) {
  await page.getByTestId('sut-auth-account').click();
  await expect(page.getByTestId('sut-auth-user')).toContainText(user);
  await expect(page.getByTestId('sut-auth-account')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sut-auth-account-menu')).toBeHidden();
  await expect(page.getByTestId('sut-auth-account')).toBeFocused();
}

/** Signs out through the menu and waits for the IdP's end-session redirect to land back on the app. */
async function signOut(page: Page) {
  await page.getByTestId('sut-auth-account').click();
  const logout = page.waitForRequest((request) => request.url().startsWith(`${issuer}/protocol/openid-connect/logout?`));
  const back = page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() && frame.url() === webApp });
  await page.getByTestId('sut-auth-sign-out').click();
  const url = new URL((await logout).url());
  expect(url.searchParams.get('post_logout_redirect_uri')).toBe(webApp);
  expect(url.searchParams.get('id_token_hint')).toMatch(jwt);
  await back;
  await expect(page.getByTestId('sut-auth-sign-in')).toBeVisible();
}

const meResponse = (page: Page) => page.waitForResponse((response) => response.url() === new URL('/v1/me', webApp).href);

let shared: Watched;

test('sign-up on the hosted page with e-mail verification ends signed in, with the state from GET /v1/me', async ({ browser }) => {
  shared = await open(browser);
  const { page } = shared;
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByTestId('sut-auth-sign-up').click();
  await page.waitForURL((url) => url.href.startsWith(issuer));
  await page.locator('#email').fill(email);
  await page.locator('#firstName').fill('Web');
  await page.locator('#lastName').fill('Registrant');
  await expect(page.locator('#password')).toHaveCount(0);
  await page.getByRole('button', { name: /register/i }).click();
  await expect(page.getByText(/verify your email/i).first()).toBeVisible();

  await page.goto(await mailedLink(email, /verify email/i));
  await page.locator('#password-new').fill(firstPassword);
  await page.locator('#password-confirm').fill(firstPassword);
  const me = meResponse(page);
  await page.locator('[type=submit]').click();
  const response = await me;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.roles).toEqual([{ role: 'customer', merchantId: null }]);
  userId = body.userId;
  await expect(page).toHaveURL(webApp);
  await expectSignedIn(page, email);
  await expectNoTokenLeak(shared);
});

test('sign-out is RP-initiated and ends the IdP session', async () => {
  const { page } = shared;
  await signOut(page);
  await expectNoTokenLeak(shared);
  await page.getByTestId('sut-auth-sign-in').click();
  await page.waitForURL((url) => url.href.startsWith(issuer));
  await expect(page.locator('#username')).toBeVisible();
});

test('forgot password stays on the IdP and returns signed in; sign-in returns to the page it started from', async () => {
  const { page } = shared;
  await page.getByRole('link', { name: /forgot password/i }).click();
  await expect(page).toHaveURL((url) => url.href.startsWith(`${issuer}/login-actions/reset-credentials`));
  await page.locator('#username').fill(email);
  await page.locator('[type=submit]').click();
  await expect(page.getByText(/you should receive an email/i)).toBeVisible();
  await page.goto(await mailedLink(email, /reset password/i));
  await page.locator('#password-new').fill(secondPassword);
  await page.locator('#password-confirm').fill(secondPassword);
  const reset = meResponse(page);
  await page.locator('[type=submit]').click();
  expect((await (await reset).json()).userId).toBe(userId);
  await expectSignedIn(page, email);

  await signOut(page);
  await page.goto(`${webApp}#/product/pizza`);
  await page.getByTestId('sut-auth-sign-in').click();
  await fillLogin(page, email, secondPassword);
  await page.waitForURL(`${webApp}#/product/pizza`);
  await expect(page.getByTestId('sut-detail-product')).toBeVisible();
  await expectSignedIn(page, email);
  await expectNoTokenLeak(shared);
});

test('the session refreshes in memory before the access token expires; a reload ends it locally only', async ({ browser }) => {
  const watched = await open(browser, (page) => page.clock.install());
  const { page } = watched;
  await page.getByTestId('sut-auth-sign-in').click();
  await fillLogin(page, email, secondPassword);
  await expectSignedIn(page, email);
  const refresh = page.waitForResponse((response) => response.url() === oidc.token && /grant_type=refresh_token/.test(response.request().postData() ?? ''));
  expect(watched.expiresIn).toBeGreaterThan(60);
  await page.clock.fastForward((watched.expiresIn - 30 + 10) * 1000);
  expect((await refresh).status()).toBe(200);
  await expectSignedIn(page, email);
  expect(watched.tokens.length).toBeGreaterThanOrEqual(6);
  await expectNoTokenLeak(watched);

  await page.reload();
  await expect(page.getByTestId('sut-auth-sign-in')).toBeVisible();
  await page.getByTestId('sut-auth-sign-in').click();
  await expectSignedIn(page, email);
});

type Mutation = [name: string, intercept: (route: Route) => Promise<void>, notice: RegExp, tokenCalls: number];

const rewriteCallback = (mutate: (callback: URL) => void) => async (route: Route) => {
  const response = await route.fetch({ maxRedirects: 0 });
  const callback = new URL(response.headers().location);
  mutate(callback);
  await route.fulfill({ response, headers: { ...response.headers(), location: callback.href } });
};
const rewriteRequest = (mutate: (authorize: URL) => void) => async (route: Route) => {
  const authorize = new URL(route.request().url());
  mutate(authorize);
  await route.continue({ url: authorize.href });
};

const mutations: Mutation[] = [
  ['a tampered state', rewriteCallback((url) => url.searchParams.set('state', 'tampered')), /could not be completed/, 0],
  ['a wrong issuer', rewriteCallback((url) => url.searchParams.set('iss', `${issuer}-evil`)), /could not be completed/, 0],
  ['a nonce mismatch', rewriteRequest((url) => url.searchParams.set('nonce', 'not-the-stored-nonce')), /could not be completed/, 1],
  ['missing PKCE', rewriteRequest((url) => ['code_challenge', 'code_challenge_method'].forEach((key) => url.searchParams.delete(key))), /cancelled or refused/, 0],
];

test('a tampered state, a wrong issuer, a nonce mismatch and missing PKCE are rejected without a session', async ({ browser }) => {
  const users: { name: string; email: string; password: string }[] = JSON.parse(
    readFileSync(join(__dirname, '../../infra/idp/.local/test-users.json'), 'utf8'),
  );
  const customer = users.find((user) => user.name === 'customer')!;
  const watched = await open(browser);
  const { page } = watched;
  await page.getByTestId('sut-auth-sign-in').click();
  await fillLogin(page, customer.email, customer.password);
  await expectSignedIn(page, customer.email);

  for (const [name, intercept, notice, tokenCalls] of mutations) {
    await test.step(name, async () => {
      await page.reload();
      const calls = watched.meCalls;
      const exchanges = watched.tokenCalls;
      await page.route((url) => url.href.startsWith(oidc.authorize), intercept);
      await page.getByTestId('sut-auth-sign-in').click();
      await expect(page.getByTestId('sut-auth-notice')).toHaveText(notice);
      await page.unrouteAll();
      await expect(page.getByTestId('sut-auth-sign-in')).toBeVisible();
      await expect(page.getByTestId('sut-auth-account')).toHaveCount(0);
      expect(page.url()).not.toMatch(/[?&](code|state)=/);
      expect(watched.meCalls).toBe(calls);
      expect(watched.tokenCalls - exchanges).toBe(tokenCalls);
    });
  }
});

test('Keycloak refuses a redirect URI outside the client allowlist', async ({ page }) => {
  const url = new URL(oidc.authorize);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: webClientId,
    redirect_uri: 'http://127.0.0.1:5999/',
    scope: 'openid',
    state: 'outside',
    code_challenge: 'x'.repeat(43),
    code_challenge_method: 'S256',
  }).toString();
  await page.goto(url.href);
  await expect(page.getByText(/invalid parameter: redirect_uri/i)).toBeVisible();
  expect(page.url().startsWith(issuer)).toBe(true);
});
