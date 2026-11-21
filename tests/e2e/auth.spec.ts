import { expect, test } from '@playwright/test';

test('a build without auth configuration says sign-in is unavailable and creates no session', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  const unavailable = page.getByTestId('sut-auth-unavailable');
  await expect(unavailable).toHaveText('Sign-in isn’t available in this build.');
  await expect(page.getByTestId('sut-auth-sign-in')).toHaveCount(0);
  await expect(page.getByTestId('sut-auth-sign-up')).toHaveCount(0);
  await expect(page.getByTestId('sut-auth-account')).toHaveCount(0);
  await page.getByTestId('sut-language').selectOption('cs');
  await expect(unavailable).toHaveText('Přihlášení v této verzi není k dispozici.');
  await page.getByTestId('sut-language').selectOption('de');
  await expect(unavailable).toHaveText('Die Anmeldung ist in dieser Version nicht verfügbar.');

  await page.goto('/?code=forged&state=forged#/');
  await expect(unavailable).toBeVisible();
  await expect(page.getByTestId('sut-auth-account')).toHaveCount(0);
  expect(requests.filter((url) => /openid-configuration|\/v1\/me|\/token/.test(url))).toEqual([]);
  const storage = await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)].flat());
  expect(storage.filter((key) => /signin|token|oidc|auth/i.test(key))).toEqual([]);
  await expect(page.locator('input[type=password]')).toHaveCount(0);
});
