import {test,expect,type Page} from '@playwright/test';
import {cartButton,search} from '../e2e/support/locators';

const origin=new URL(process.env.PAGES_URL??'http://invalid').origin;
const entry=`./${process.env.PAGES_QUERY??''}`;

async function open(page:Page,hash=''){
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===origin)errors.push(`${r.status()} ${r.url()}`);});
  const response=await page.goto(entry+hash);
  expect(response?.status()).toBe(200);
  await page.waitForLoadState('load');
  return errors;
}

test('deployed preview is visibly labelled as a demo',async({page})=>{
  const errors=await open(page);
  await expect(page.getByText('Preview catalogue. Prices and availability are illustrative.')).toBeVisible();
  await expect(page.getByText('No real orders or payments are processed.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('search, add to cart and disabled checkout on the deployed preview',async({page},testInfo)=>{
  const errors=await open(page);
  await search(page).fill('Margherita');
  await expect(page.locator('[data-testid^="sut-product-link-"]')).toHaveText(['Margherita pizza']);
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await cartButton(page,1).click();
  const dialog=page.getByTestId('sut-cart-dialog');
  await expect(dialog.getByTestId('sut-cart-line-pizza')).toContainText('Margherita pizza');
  await expect(dialog.getByTestId('sut-checkout-disabled')).toBeDisabled();
  await expect(dialog.getByText('Checkout is disabled until payment and delivery integrations are ready.')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('pages-cart.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('a hash deep link loads directly with no 404 fallback',async({page},testInfo)=>{
  const errors=await open(page,'#/product/flowers');
  await expect(page.getByRole('heading',{level:1,name:'Fresh flowers'})).toBeVisible();
  await expect(page.getByTestId('sut-detail-merchant-link')).toHaveText('Bloom & Grow');
  await page.screenshot({path:testInfo.outputPath('pages-deep-link.png'),fullPage:true});
  expect(errors).toEqual([]);
});
