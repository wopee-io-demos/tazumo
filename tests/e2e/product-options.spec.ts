import {test,expect,type Page} from '@playwright/test';
import {scan} from './support/axe';

const option=(page:Page,id:string)=>page.getByTestId(`sut-option-${id}`);

test('options change the unit price and each configuration is its own cart line',async({page})=>{
  await page.goto('/#/product/pizza');
  await expect(page.getByTestId('sut-option-group-size')).toBeVisible();
  await expect(option(page,'medium')).toBeChecked();
  await expect(page.getByTestId('sut-detail-price')).toHaveText('€11.90');
  await page.getByRole('radio',{name:/Large \+€3\.50/}).check();
  await page.getByRole('checkbox',{name:/Olives \+€0\.90/}).check();
  await option(page,'mushrooms').check();
  await expect(page.getByTestId('sut-detail-price')).toHaveText('€17.20');
  await page.getByTestId('sut-add-pizza').click();
  await expect(page.getByTestId('sut-detail-quantity-pizza')).toHaveText('1');
  await option(page,'medium').check();
  await option(page,'olives').uncheck();
  await option(page,'mushrooms').uncheck();
  await expect(page.getByTestId('sut-add-pizza')).toBeVisible();
  await page.getByTestId('sut-add-pizza').click();
  await page.getByTestId('sut-detail-increase-pizza').click();
  await page.getByTestId('sut-cart-open').click();
  await expect(page.getByTestId('sut-cart-line-pizza')).toContainText('Medium');
  await expect(page.getByTestId('sut-cart-line-total-pizza')).toContainText('€23.80');
  await expect(page.getByTestId('sut-cart-line-options-pizza-large-olives-mushrooms')).toHaveText('Large, Olives, Mushrooms');
  await expect(page.getByTestId('sut-cart-line-total-pizza-large-olives-mushrooms')).toContainText('€17.20');
  await expect(page.getByTestId('sut-cart-subtotal')).toHaveText('€41.00');
  await page.getByTestId('sut-cart-increase-pizza-large-olives-mushrooms').click();
  await expect(page.getByTestId('sut-cart-subtotal')).toHaveText('€58.20');
  await page.getByTestId('sut-cart-remove-pizza').click();
  await expect(page.getByTestId('sut-cart-line-pizza')).toHaveCount(0);
  await expect(page.getByTestId('sut-cart-subtotal')).toHaveText('€34.40');
});

test('too many extras show a validation message and disable add; unavailable options cannot be chosen',async({page})=>{
  await page.goto('/#/product/pizza');
  await expect(option(page,'truffle')).toBeDisabled();
  await expect(page.getByTestId('sut-option-group-extras')).toContainText('Truffle +€4.00 (unavailable)');
  for(const id of ['olives','mushrooms','chilli-oil'])await option(page,id).check();
  await expect(page.getByTestId('sut-options-error')).toHaveCount(0);
  await option(page,'extra-mozzarella').check();
  await expect(page.getByTestId('sut-options-error')).toHaveText('Extras: Choose up to 3.');
  await expect(page.getByTestId('sut-option-group-extras')).toHaveAttribute('aria-describedby','options-error');
  await expect(page.getByTestId('sut-detail-price')).toHaveText('€14.30');
  await expect(page.getByTestId('sut-add-pizza')).toBeDisabled();
  await option(page,'olives').uncheck();
  await expect(page.getByTestId('sut-options-error')).toHaveCount(0);
  await expect(page.getByTestId('sut-add-pizza')).toBeEnabled();
});

test('a negative delta and an optional single choice in Czech',async({page})=>{
  await page.goto('/?lang=cs#/product/burger');
  await expect(page.getByTestId('sut-option-group-sauce')).toContainText('Omáčka');
  await page.getByTestId('sut-option-none-sauce').check();
  await page.getByTestId('sut-add-burger').click();
  await page.getByTestId('sut-cart-open').click();
  await expect(page.getByTestId('sut-cart-line-burger-none')).toBeVisible();
  await expect(page.getByTestId('sut-cart-line-total-burger-none')).toContainText(/13,90\s€/);
  await expect(page.getByTestId('sut-cart-line-options-burger-none')).toHaveCount(0);
  await page.getByTestId('sut-cart-close').click();
  await page.goto('/?lang=cs#/product/pizza');
  await page.getByRole('radio',{name:/Malá −2,00\s€/}).check();
  await expect(page.getByTestId('sut-detail-price')).toHaveText(/9,90\s€/);
});

test('the option picker has no new serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/#/product/pizza');
  for(const id of ['olives','mushrooms','chilli-oil','extra-mozzarella'])await option(page,id).check();
  await expect(page.getByTestId('sut-options-error')).toBeVisible();
  const result=await scan(page,testInfo,'product-options');
  expect(result.unexpected).toEqual([]);
});
