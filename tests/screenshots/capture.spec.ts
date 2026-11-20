import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const outDir=process.env.SCREENSHOT_DIR??'docs/screenshots/web';
const fixedTime=new Date('2026-11-20T09:41:00+01:00');

async function open(page:Page){
  await page.clock.setFixedTime(fixedTime);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'What are you craving?'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Margherita pizza'})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}

async function shot(page:Page,name:string,fullPage:boolean){
  const project=test.info().project.name;
  mkdirSync(outDir,{recursive:true});
  await page.screenshot({path:join(outDir,`${project}-${name}.png`),fullPage,animations:'disabled',caret:'hide'});
}

test('home catalogue',async({page})=>{
  await open(page);
  await expect(page.locator('.product')).toHaveCount(8);
  await shot(page,'home',test.info().project.name==='desktop');
});

test('category filter',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'Groceries'}).click();
  await expect(page.getByRole('heading',{name:'Sourdough loaf'})).toBeVisible();
  await expect(page.locator('.product')).toHaveCount(2);
  await page.locator('.categories').evaluate(el=>el.scrollIntoView({block:'start'}));
  await shot(page,'category-groceries',false);
});

test('search results',async({page})=>{
  await open(page);
  await page.getByRole('textbox',{name:'What are you looking for?'}).fill('fresh');
  await expect(page.locator('.product')).toHaveCount(3);
  await shot(page,'search-fresh',true);
});

test('cart with items',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await page.getByRole('button',{name:'Add Sourdough loaf'}).click();
  await page.getByRole('button',{name:'Add Fresh flowers'}).click();
  await page.getByRole('button',{name:/Cart, 4/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('€46.20')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Checkout coming later'})).toBeDisabled();
  await page.locator('[data-cart-close]').blur();
  await shot(page,'cart',false);
});
