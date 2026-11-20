import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { issuer, ports } from './env.mts';

const api = `http://127.0.0.1:${ports.api}`;
const tid = (page: Page, id: string) => page.getByTestId(`sut-backoffice-${id}`);

async function tokenFor(sub: string) {
  const response = await fetch(`${issuer}/test-token?sub=${sub}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function apiAs<T>(sub: string, path: string, method = 'GET'): Promise<{ status: number; body: T }> {
  const response = await fetch(`${api}${path}`, { method, headers: { authorization: `Bearer ${await tokenFor(sub)}` } });
  return { status: response.status, body: (response.status === 204 ? undefined : await response.json()) as T };
}

type Me = { userId: string; roles: { role: string; merchantId: string | null }[] };
const userIdOf = async (sub: string) => (await apiAs<Me>(sub, '/v1/me')).body.userId;

async function merchants() {
  const markets = (await (await fetch(`${api}/v1/markets`)).json()) as { code: string }[];
  const lists = await Promise.all(markets.map(async (m) => (await fetch(`${api}/v1/merchants?marketCode=${m.code}`)).json()));
  const all = (lists as { id: string; name: string }[][]).flat();
  const ownId = (await apiAs<Me>('bo-staff-a', '/v1/me')).body.roles.find((g) => g.role === 'merchant_staff')!.merchantId;
  return { own: all.find((m) => m.id === ownId)!, other: all.find((m) => m.id !== ownId)! };
}

async function signIn(page: Page, sub: string, path = '/') {
  await page.goto(path);
  await tid(page, 'sign-in').click();
  await page.getByRole('link', { name: `Sign in as ${sub}` }).click();
}

async function expectNoSeriousAxe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
}

test.beforeEach(async () => {
  const target = await userIdOf('bo-target');
  const { own } = await merchants();
  await apiAs('bo-admin', `/v1/admin/users/${target}/roles/support`, 'DELETE');
  await apiAs('bo-admin', `/v1/admin/users/${target}/roles/merchant_staff?merchantId=${own.id}`, 'DELETE');
});

test('signed-out page is labelled as a prototype and accessible', async ({ page }) => {
  await page.goto('/');
  await expect(tid(page, 'prototype')).toHaveText(/Prototype/);
  await expect(tid(page, 'sign-in')).toBeVisible();
  await expectNoSeriousAxe(page);
});

test('a customer-only principal gets no back-office access and no request beyond /v1/me', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/v1/')) apiCalls.push(url.pathname);
  });
  await signIn(page, 'bo-customer');
  await expect(tid(page, 'no-access')).toHaveText('No back-office access');
  await expectNoSeriousAxe(page);
  await expect(tid(page, 'nav')).toHaveCount(0);
  expect(apiCalls).toEqual(['/v1/me']);
});

test('merchant staff see their own staff list and a 403 page for another merchant', async ({ page }) => {
  const { own, other } = await merchants();
  await signIn(page, 'bo-staff-a');
  await tid(page, `nav-merchant-${own.id}`).click();
  await expect(page.getByRole('heading', { name: `Staff of ${own.name}` })).toBeVisible();
  await expect(tid(page, 'staff-row')).toHaveCount(1);
  await expect(tid(page, 'nav-grants')).toHaveCount(0);
  await expectNoSeriousAxe(page);

  const responses: number[] = [];
  page.on('response', (r) => r.url().endsWith(`/v1/merchants/${other.id}/staff`) && responses.push(r.status()));
  await page.evaluate((id) => (location.hash = `#/merchants/${id}/staff`), other.id);
  await expect(tid(page, 'forbidden')).toBeVisible();
  expect(responses).toEqual([403]);
  await expectNoSeriousAxe(page);
});

test('admin controls are not rendered for support, and the API rejects them anyway', async ({ page }) => {
  await signIn(page, 'bo-support', '/#/grants');
  await expect(tid(page, 'not-for-role')).toBeVisible();
  await expect(tid(page, 'nav-grants')).toHaveCount(0);
  await expect(tid(page, 'grant-submit')).toHaveCount(0);
  await expectNoSeriousAxe(page);
  const target = await userIdOf('bo-target');
  expect((await apiAs('bo-support', `/v1/admin/users/${target}/roles/support`, 'PUT')).status).toBe(403);
});

test('admin grants and revokes support and merchant staff with plain-language results', async ({ page }) => {
  const { own } = await merchants();
  const target = await userIdOf('bo-target');
  await signIn(page, 'bo-admin');
  await tid(page, 'nav-grants').click();
  await expect(page.getByLabel('Role').locator('option')).toHaveText(['Merchant staff', 'Support']);
  await expectNoSeriousAxe(page);

  const result = tid(page, 'grant-result');
  await page.getByLabel('User ID').fill(target);
  await page.getByLabel('Role').selectOption('support');
  await tid(page, 'grant-submit').click();
  await expect(result).toHaveText(`Granted: Support for user ${target}.`);
  await tid(page, 'grant-submit').click();
  await expect(result).toHaveText(`No change: user ${target} already has Support.`);
  await tid(page, 'revoke-submit').click();
  await expect(result).toHaveText(`Revoked: Support for user ${target} (if it was granted).`);

  await page.getByLabel('Role').selectOption('merchant_staff');
  await page.getByLabel('Merchant').selectOption(own.id);
  await tid(page, 'grant-submit').click();
  await expect(result).toHaveText(`Granted: Merchant staff of ${own.name} for user ${target}.`);
  await tid(page, 'revoke-submit').click();
  await expect(result).toContainText('Revoked');
});

test('admin sees the API 400, 403 and 404 errors in plain language', async ({ page }) => {
  await signIn(page, 'bo-admin');
  await tid(page, 'nav-grants').click();
  const result = tid(page, 'grant-result');
  await page.getByLabel('Role').selectOption('support');

  await page.getByLabel('User ID').fill('not-a-uuid');
  await tid(page, 'grant-submit').click();
  await expect(result).toHaveText(/request was not valid/);
  await expectNoSeriousAxe(page);

  await page.getByLabel('User ID').fill('00000000-0000-4000-8000-000000000000');
  await tid(page, 'grant-submit').click();
  await expect(result).toHaveText(/No user with this ID exists/);

  await page.getByLabel('User ID').fill(await tid(page, 'user').innerText());
  await tid(page, 'grant-submit').click();
  await expect(result).toHaveText(/not allowed to change roles for this user/);
});

test('sign-in, staff lookup, staff list and sign-out work with the keyboard only', async ({ page }) => {
  const { own } = await merchants();
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(tid(page, 'sign-in')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: 'Sign in as bo-support' }).press('Enter');
  await expect(tid(page, 'nav-lookup')).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(tid(page, 'nav-lookup')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Staff lookup' })).toBeVisible();
  await expect(page.getByLabel('Merchant')).toBeEnabled();
  await expectNoSeriousAxe(page);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Merchant')).toBeFocused();
  await page.keyboard.type(own.name);
  await expect(page.getByLabel('Merchant')).toHaveValue(own.id);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: `Staff of ${own.name}` })).toBeVisible();
  await expect(tid(page, 'staff-row')).toHaveCount(1);
  await page.keyboard.press('Shift+Tab');
  await expect(tid(page, 'sign-out')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'sign-in')).toBeVisible();
});

test('the grants page works with the keyboard only, and the skip link keeps the route', async ({ page }) => {
  const target = await userIdOf('bo-target');
  await signIn(page, 'bo-admin');
  await expect(tid(page, 'nav-grants')).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(tid(page, 'nav-grants')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Role grants' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('User ID')).toBeFocused();
  await page.keyboard.type(target);
  await page.keyboard.press('Tab');
  await page.keyboard.press('S');
  await expect(page.getByLabel('Role')).toHaveValue('support');
  await page.keyboard.press('Tab');
  await expect(tid(page, 'grant-submit')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'grant-result')).toHaveText(`Granted: Support for user ${target}.`);
  await page.keyboard.press('Tab');
  await expect(tid(page, 'revoke-submit')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'grant-result')).toContainText('Revoked');

  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/grants$/);
  await expect(page.locator('main')).toBeFocused();
});

test('tokens are kept in memory only', async ({ page }) => {
  await signIn(page, 'bo-admin');
  await expect(tid(page, 'nav')).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).toBe('{}{}');
});

test('an expired session returns to sign-in with a notice', async ({ page }) => {
  const { own } = await merchants();
  await signIn(page, 'bo-short-session');
  await expect(tid(page, 'nav-lookup')).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.evaluate((id) => (location.hash = `#/merchants/${id}/staff`), own.id);
  await expect(tid(page, 'auth-error')).toHaveText('Your session has expired. Please sign in again.');
  await expect(tid(page, 'sign-in')).toBeVisible();
});

test('when the API has no auth configured the app says the back office is unavailable', async ({ page }) => {
  await signIn(page, 'bo-admin', `http://127.0.0.1:${ports.previewNoAuth}/`);
  await expect(tid(page, 'unavailable')).toBeVisible();
  await expect(tid(page, 'nav')).toHaveCount(0);
  await expectNoSeriousAxe(page);
});
