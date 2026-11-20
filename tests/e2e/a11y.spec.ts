import {test,expect} from '@playwright/test';
import {search,productHeadings,cartButton} from './support/locators';
import {scan,gate,baseline,blockingImpacts} from './support/axe';

for(const palette of ['violet','coral','emerald','midnight']){
  test(`catalogue (${palette}) has no unexpected serious or critical axe violations`,async({page},testInfo)=>{
    await page.goto('/');
    await page.getByLabel('Colors').selectOption(palette);
    await expect(productHeadings(page).first()).toBeVisible();
    expect((await scan(page,testInfo,`catalogue-${palette}`)).unexpected).toEqual([]);
  });
}

test('search results have no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await search(page).fill('Morning Market');
  await expect(productHeadings(page)).toHaveCount(2);
  expect((await scan(page,testInfo,'search-results')).unexpected).toEqual([]);
});

test('empty search results have no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await search(page).fill('no-such-product-xyz');
  await expect(page.getByRole('status')).toBeVisible();
  expect((await scan(page,testInfo,'search-empty')).unexpected).toEqual([]);
});

test('cart with items has no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await page.getByRole('button',{name:'Add Sourdough loaf'}).click();
  await cartButton(page,2).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await scan(page,testInfo,'cart')).unexpected).toEqual([]);
});

test('empty cart has no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await cartButton(page,0).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await scan(page,testInfo,'cart-empty')).unexpected).toEqual([]);
});

test('the gate fails on a new critical violation that the baseline does not list',async({page},testInfo)=>{
  await page.goto('/');
  await page.evaluate(()=>{const b=document.createElement('button');b.setAttribute('data-testid','a11y-gate-probe');document.querySelector('main')?.append(b);});
  const {unexpected}=await scan(page,testInfo,'gate-probe');
  expect(unexpected.map(v=>v.rule)).toContain('button-name');
});

test('every baseline entry is a documented, tracked serious or critical rule',()=>{
  for(const e of baseline.entries){
    expect(blockingImpacts).toContain(e.impact);
    expect(e.issue).toMatch(/^https:\/\/github\.com\/wopee-io-demos\/tazumo\/issues\/\d+$/);
    expect(e.reason.length).toBeGreaterThan(20);
    expect(e.maxNodes).toBeGreaterThan(0);
  }
  expect(gate('unit',[{id:'color-contrast',impact:'serious',help:'',nodes:[{target:['x']}]}]).unexpected).toHaveLength(1);
  expect(gate('unit',[{id:'region',impact:'moderate',help:'',nodes:[{target:['x']}]}]).unexpected).toHaveLength(0);
});
