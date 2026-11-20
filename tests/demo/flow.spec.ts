import {test,expect} from '@playwright/test';

const pause=(ms=1200)=>new Promise(r=>setTimeout(r,ms));

test('demo flow: search Margherita, add it, open the cart',async({page})=>{
  await page.goto('/');
  const search=page.getByRole('textbox',{name:'What are you looking for?'});
  await expect(search).toBeVisible();
  await pause(1500);
  await search.click();
  await search.pressSequentially('Margherita',{delay:110});
  await expect(page.getByRole('heading',{level:3})).toHaveText(['Margherita pizza']);
  await pause();
  const add=page.getByRole('button',{name:'Add Margherita pizza'});
  await add.scrollIntoViewIfNeeded();
  await pause(800);
  await add.click();
  const cart=page.getByRole('button',{name:'Cart, 1'});
  await expect(cart).toBeVisible();
  await pause();
  await cart.click();
  const dialog=page.getByRole('dialog',{name:/Your basket/});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.cartLine')).toHaveCount(1);
  await expect(dialog.locator('.cartLine strong')).toHaveText('Margherita pizza');
  await expect(dialog.locator('.stepper span')).toHaveText('1');
  await expect(dialog.locator('.total')).toContainText('Subtotal');
  await expect(dialog.locator('.total')).toContainText('€11.90');
  await expect(dialog.getByText('Checkout is disabled until payment and delivery integrations are ready.')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Checkout coming later'})).toBeDisabled();
  await pause(2500);
});
