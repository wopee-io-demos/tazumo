import {readFileSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';

const contract=JSON.parse(readFileSync('contracts/sut.json','utf8'));
const {selectors,selectorTemplates,routes}=contract.web as {selectors:Record<string,string>;selectorTemplates:Record<string,string>;routes:Record<string,string>};
const fill=(pattern:string,values:Record<string,string>)=>pattern.replace(/\{(\w+)\}/g,(_,k)=>values[k]);
const sel=(page:Page,key:string)=>page.locator(selectors[key]);
const tpl=(page:Page,key:string,values:Record<string,string>)=>page.locator(fill(selectorTemplates[key],values));

test('merchant-detail-cart journey runs on contract selectors and routes only',async({page})=>{
  const ids={merchantId:'piazza-local',productId:'pizza'};
  await page.goto('/'+routes.home);
  await expect(sel(page,'merchantList')).toBeVisible();
  await tpl(page,'merchantLink',ids).click();
  await expect(page).toHaveURL(new RegExp(fill(routes.merchant,ids)+'$'));
  await expect(sel(page,'merchantDetail')).toBeVisible();
  await expect(sel(page,'breadcrumbHome')).toBeVisible();
  await expect(sel(page,'merchantProductPizza')).toContainText('Margherita pizza');
  await tpl(page,'add',ids).click();
  await sel(page,'merchantDetail').locator(selectors.productLinkPizza).click();
  await expect(page).toHaveURL(new RegExp(fill(routes.product,ids)+'$'));
  await expect(sel(page,'detailProduct')).toBeVisible();
  await expect(sel(page,'detailPrice')).toContainText('11.90');
  await expect(sel(page,'detailQuantityPizza')).toHaveText('1');
  await sel(page,'detailIncreasePizza').click();
  await expect(tpl(page,'detailQuantity',ids)).toHaveText('2');
  await sel(page,'cartOpen').click();
  await expect(sel(page,'cartDialog')).toBeVisible();
  await expect(sel(page,'cartLinePizza')).toContainText('Margherita pizza');
  await expect(sel(page,'cartLineTotalPizza')).toContainText('23.80');
  await expect(sel(page,'cartSubtotal')).toContainText('23.80');
  await expect(sel(page,'checkoutDisabled')).toBeDisabled();
  await sel(page,'cartRemovePizza').click();
  await expect(sel(page,'cartEmpty')).toBeVisible();
  await sel(page,'cartClose').click();
  await expect(sel(page,'cartDialog')).not.toBeVisible();
});

test('unknown merchant and product routes show contract not-found states',async({page})=>{
  await page.goto('/'+fill(routes.merchant,{merchantId:'no-such-merchant'}));
  await expect(sel(page,'merchantNotFound')).toBeVisible();
  await page.goto('/'+fill(routes.product,{productId:'no-such-product'}));
  await expect(sel(page,'detailNotFound')).toBeVisible();
  await sel(page,'backToMerchants').click();
  await expect(sel(page,'merchantList')).toBeVisible();
});

test('every catalogue fixture is addressable through the product and add templates',async({page})=>{
  await page.goto('/');
  await sel(page,'categoryAll').click();
  for(const {id,name} of contract.fixtures.products as {id:string;name:string}[]){
    await expect(tpl(page,'product',{productId:id})).toContainText(name);
    await expect(tpl(page,'add',{productId:id})).toBeEnabled();
  }
  await sel(page,'categoryGroceries').click();
  await expect(tpl(page,'product',{productId:'bread'})).toBeVisible();
  await expect(sel(page,'productPizza')).toHaveCount(0);
});
