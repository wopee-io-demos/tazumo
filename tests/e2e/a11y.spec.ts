import {test,expect} from '@playwright/test';
import {search,productHeadings,cartButton} from './support/locators';
import {scan,gate,baseline,blockingImpacts} from './support/axe';

const expectBaseline=(r:{unexpected:unknown[];stale:string[]})=>{
  expect(r.unexpected,'serious/critical axe violations not matching tests/e2e/a11y-baseline.json').toEqual([]);
  expect(r.stale,'baseline entries that no longer reproduce, remove them').toEqual([]);
};

for(const palette of ['violet','coral','emerald','midnight']){
  test(`catalogue (${palette}) has no unexpected serious or critical axe violations`,async({page},testInfo)=>{
    await page.goto('/');
    await page.getByLabel('Colors').selectOption(palette);
    await expect(productHeadings(page).first()).toBeVisible();
    expectBaseline(await scan(page,testInfo,`catalogue-${palette}`));
  });
}

test('search results have no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await search(page).fill('Morning Market');
  await expect(productHeadings(page)).toHaveCount(2);
  expectBaseline(await scan(page,testInfo,'search-results'));
});

test('empty search results have no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await search(page).fill('no-such-product-xyz');
  await expect(page.getByRole('status')).toBeVisible();
  expectBaseline(await scan(page,testInfo,'search-empty'));
});

test('cart with items has no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await page.getByRole('button',{name:'Add Sourdough loaf'}).click();
  await cartButton(page,2).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expectBaseline(await scan(page,testInfo,'cart'));
});

test('empty cart has no unexpected serious or critical axe violations',async({page},testInfo)=>{
  await page.goto('/');
  await cartButton(page,0).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expectBaseline(await scan(page,testInfo,'cart-empty'));
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
    expect(e.nodes).toBeGreaterThan(0);
  }
  expect(gate('unit',[{id:'color-contrast',impact:'serious',help:'',nodes:[{target:['x']}]}]).unexpected).toHaveLength(1);
  expect(gate('unit',[{id:'region',impact:'moderate',help:'',nodes:[{target:['x']}]}]).unexpected).toHaveLength(0);
  const [entry]=baseline.entries;
  if(entry){
    const nodes=Array.from({length:entry.nodes},()=>({target:['x']}));
    expect(gate(entry.scan,[{id:entry.rule,impact:entry.impact,help:'',nodes}]).unexpected).toHaveLength(0);
    expect(gate(entry.scan,[{id:entry.rule,impact:entry.impact,help:'',nodes:[...nodes,{target:['y']}]}]).unexpected).toHaveLength(1);
    expect(gate(entry.scan,[{id:entry.rule,impact:'critical',help:'',nodes}]).unexpected).toHaveLength(entry.impact==='critical'?0:1);
    expect(gate(entry.scan,[]).stale).toEqual([`${entry.scan}:${entry.rule}`]);
  }
});
