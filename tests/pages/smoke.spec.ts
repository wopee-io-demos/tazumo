import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
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

test('version.json and the version meta tag identify this deployment',async({page,request})=>{
  const read=(path:string)=>JSON.parse(readFileSync(join(__dirname,'..','..',path),'utf8'));
  const response=await request.get(`version.json${process.env.PAGES_QUERY??''}`);
  expect(response.status()).toBe(200);
  const info=await response.json();
  expect(info).toEqual({
    version:read('package.json').version,
    commit:process.env.EXPECTED_COMMIT??expect.stringMatching(/^[0-9a-f]{40}$/),
    builtAt:expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    contracts:{sut:read('contracts/sut.json').version,openapi:read('contracts/openapi.json').info.version}
  });
  await open(page);
  await expect(page.locator('meta[name="tazumo-version"]')).toHaveAttribute('content',info.version);
  await expect(page.locator('meta[name="tazumo-commit"]')).toHaveAttribute('content',info.commit);
});
