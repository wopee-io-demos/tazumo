import {test,expect} from '@playwright/test';
test('browse category and search merchants',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'What are you craving?'})).toBeVisible();
  await page.getByRole('button',{name:'Groceries'}).click();
  await expect(page.getByRole('heading',{name:'Sourdough loaf'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toHaveCount(0);
  await page.getByRole('button',{name:'✨ Everything'}).click();
  await page.getByRole('textbox',{name:'Search products and shops'}).fill('Piazza');
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sourdough loaf'})).toHaveCount(0);
});
test('cart quantity and transparent no-checkout policy',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Add Margherita pizza to cart'}).click();
  await page.getByRole('button',{name:/View cart, 1 items/}).click();
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

test('cart traps focus and closes with Escape, restoring opener focus',async({page})=>{
 await page.goto('/');
 const opener=page.getByRole('button',{name:/View cart/});
 await opener.click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('button',{name:'Close cart'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(opener).toBeFocused();
});
