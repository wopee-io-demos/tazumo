import {test,expect,type Page} from '@playwright/test';

const switcher=(page:Page)=>page.getByRole('banner').getByRole('combobox',{name:/Language|Jazyk|Sprache/});

test('header language switcher is available on every route and updates content and document lang',async({page})=>{
  for(const path of ['/','/#/merchant/piazza-local','/#/product/pizza']){
    await page.goto(path);
    await expect(switcher(page)).toBeVisible();
    await expect(switcher(page)).toHaveAccessibleName('Language');
  }
  await switcher(page).selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang','de');
  await expect(switcher(page)).toHaveAccessibleName('Sprache');
  await expect(page.getByTestId('sut-detail-price')).toHaveText(/11,90\s€/);
  await expect(page.getByRole('button',{name:'Warenkorb, 0'})).toBeVisible();
  await page.getByTestId('sut-detail-merchant-link').click();
  await expect(page.getByRole('heading',{level:2,name:'Produkte'})).toBeVisible();
  await expect(switcher(page)).toHaveValue('de');
});

test('options are named in their own language for screen readers',async({page})=>{
  await page.goto('/');
  const options=switcher(page).locator('option');
  await expect(options).toHaveText(['English','Čeština','Deutsch']);
  await expect(options.nth(1)).toHaveAttribute('lang','cs');
  await expect(page.getByLabel('Language')).toHaveCount(1);
});

test('language choice persists across reloads and route changes',async({page})=>{
  await page.goto('/#/merchant/morning-market');
  await switcher(page).selectOption('cs');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','cs');
  await expect(switcher(page)).toHaveValue('cs');
  await expect(page.getByRole('heading',{level:2,name:'Produkty'})).toBeVisible();
  await page.getByTestId('sut-breadcrumb-home').click();
  await expect(page.getByRole('heading',{name:'Na co máte chuť?'})).toBeVisible();
});

test('a fresh visitor starts in English',async({page})=>{
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(switcher(page)).toHaveValue('en');
});

test('an unknown stored language falls back to English',async({page})=>{
  await page.addInitScript(()=>window.localStorage.setItem('tazumo.language','xx'));
  await page.goto('/');
  await expect(switcher(page)).toHaveValue('en');
  await expect(page.getByRole('heading',{name:'What are you craving?'})).toBeVisible();
});

test('blocked storage still lets the visitor switch language',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});
  });
  await page.goto('/');
  await switcher(page).selectOption('de');
  await expect(page.getByRole('heading',{name:'Worauf hast du Lust?'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('switcher is reachable by keyboard from the header',async({page})=>{
  await page.goto('/');
  await page.getByRole('link',{name:'Tazumo home'}).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:/Cart, 0/})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(switcher(page)).toBeFocused();
  await expect(switcher(page)).toHaveCSS('outline-style','solid');
});

test('header fits a phone viewport with the switcher',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  for(const path of ['/','/#/product/apples']){
    await page.goto(path);
    await expect(switcher(page)).toBeVisible();
    await expect(page.getByRole('button',{name:/Cart, 0/})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,path).toBeLessThanOrEqual(0);
  }
});
