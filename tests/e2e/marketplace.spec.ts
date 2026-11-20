import {test,expect} from '@playwright/test';
test('browse category and search merchants',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'What are you craving?'})).toBeVisible();
  await page.getByRole('button',{name:'Groceries'}).click();
  await expect(page.getByRole('heading',{name:'Sourdough loaf'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toHaveCount(0);
  await page.getByRole('button',{name:'✨ Everything'}).click();
  await page.getByRole('textbox',{name:'What are you looking for?'}).fill('Piazza');
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sourdough loaf'})).toHaveCount(0);
});
test('cart quantity and transparent no-checkout policy',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await page.getByRole('button',{name:/Cart, 1/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('€11.90').first()).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Checkout coming later'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Remove one Margherita pizza'}).click();
  await expect(dialog.getByText('Your basket is empty.')).toBeVisible();
});
test('palette independent from catalogue',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toBeVisible();
  await page.getByLabel('Colors').selectOption('emerald');
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toBeVisible();
  await expect(page.locator('.app')).toHaveCSS('--primary','#087F62');
});

test('language changes preserve cart, search and accessibility',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Add Margherita pizza'}).click();
 await page.getByRole('textbox',{name:'What are you looking for?'}).fill('Piazza');
 await page.getByLabel('Language').selectOption('cs');
 await expect(page.locator('html')).toHaveAttribute('lang','cs');
 await expect(page.getByRole('heading',{name:'Na co máte chuť?'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Co hledáte?'})).toHaveValue('Piazza');
 await page.getByRole('button',{name:/Košík, 1/}).click();
 await expect(page.getByRole('dialog')).toContainText('Margherita pizza');
 await expect(page.getByRole('dialog')).toContainText('11,90');
 await page.keyboard.press('Escape');
 await page.getByLabel('Jazyk').selectOption('de');
 await expect(page.locator('html')).toHaveAttribute('lang','de');
 await expect(page.getByRole('heading',{name:'Worauf hast du Lust?'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Wonach suchst du?'})).toHaveValue('Piazza');
 await page.getByRole('button',{name:/Warenkorb, 1/}).click();
 await expect(page.getByRole('dialog')).toContainText('Margherita pizza');
 await expect(page.getByRole('dialog')).toContainText('11,90');
});
test('native dialog restores keyboard focus after Escape',async({page})=>{
 await page.goto('/');
 const opener=page.getByRole('button',{name:/Cart, 0/});
 await opener.click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('button',{name:'Close cart'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(opener).toBeFocused();
});
