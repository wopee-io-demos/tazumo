import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const key='tazumo.favourites';

test('toggle a favourite on the card and the merchant page',async({page})=>{
  await page.goto('/');
  const heart=page.getByTestId('sut-favourite-piazza-local');
  await expect(heart).toHaveAttribute('aria-pressed','false');
  await expect(heart).toHaveAccessibleName('Add Piazza Local to favourites');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed','true');
  await expect(heart).toHaveAccessibleName('Remove Piazza Local from favourites');
  await page.getByTestId('sut-merchant-link-piazza-local').click();
  const detailHeart=page.getByTestId('sut-favourite-piazza-local');
  await expect(detailHeart).toHaveAttribute('aria-pressed','true');
  await detailHeart.click();
  await expect(detailHeart).toHaveAccessibleName('Add Piazza Local to favourites');
  await page.getByTestId('sut-language').selectOption('cs');
  await expect(detailHeart).toHaveAccessibleName('Přidat Piazza Local do oblíbených');
  await page.getByTestId('sut-language').selectOption('de');
  await detailHeart.click();
  await expect(detailHeart).toHaveAccessibleName('Piazza Local aus Favoriten entfernen');
});

test('favourites filter narrows products and merchants and survives reload',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-favourite-morning-market').click();
  await page.getByTestId('sut-favourite-city-tech').click();
  await page.getByTestId('sut-favourites-filter').click();
  await expect(page.getByTestId('sut-favourites-filter')).toHaveAttribute('aria-pressed','true');
  const merchantLinks=page.getByTestId('sut-merchant-list').getByRole('link');
  await expect(merchantLinks).toHaveText(['Morning Market','City Tech']);
  await expect(page.locator('.product h3')).toHaveText(['Sourdough loaf','Local apples 1 kg','Wireless headphones']);
  await page.getByTestId('sut-category-groceries').click();
  await expect(merchantLinks).toHaveText(['Morning Market']);
  await page.reload();
  await expect(page.getByTestId('sut-favourite-morning-market')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('sut-favourite-city-tech')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('sut-favourite-piazza-local')).toHaveAttribute('aria-pressed','false');
});

test('empty favourites filter shows an empty state and the reset control',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-favourites-filter').click();
  await expect(page.getByTestId('sut-merchants-empty')).toContainText('No favourites yet.');
  await expect(page.getByRole('status')).toHaveText('No matching products.');
  await page.getByTestId('sut-search-reset').click();
  await expect(page.getByTestId('sut-favourites-filter')).toHaveAttribute('aria-pressed','false');
  await expect(page.getByTestId('sut-merchant-list').getByRole('link')).toHaveCount(7);
});

test('favourites sync across tabs',async({context})=>{
  const first=await context.newPage(),second=await context.newPage();
  await first.goto('/');
  await second.goto('/');
  await first.getByTestId('sut-favourite-bloom-and-grow').click();
  await expect(second.getByTestId('sut-favourite-bloom-and-grow')).toHaveAttribute('aria-pressed','true');
  await second.getByTestId('sut-favourite-bloom-and-grow').click();
  await expect(first.getByTestId('sut-favourite-bloom-and-grow')).toHaveAttribute('aria-pressed','false');
});

test('corrupted storage and unknown merchant ids are ignored without errors',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(k=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(k,'{not json');sessionStorage.setItem('seeded','1');}},key);
  await page.goto('/');
  await page.getByTestId('sut-favourites-filter').click();
  await expect(page.getByTestId('sut-merchants-empty')).toContainText('No favourites yet.');
  await page.evaluate(k=>localStorage.setItem(k,JSON.stringify(['closed-merchant','green-table',7])),key);
  await page.reload();
  await page.getByTestId('sut-favourites-filter').click();
  await expect(page.getByTestId('sut-merchant-list').getByRole('link')).toHaveText(['Green Table']);
  await page.getByTestId('sut-favourites-filter').click();
  await page.getByTestId('sut-favourite-city-tech').click();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key)).toEqual(['closed-merchant','green-table','city-tech']);
  expect(errors).toEqual([]);
});

test('without storage favourites still work in memory',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});});
  await page.goto('/');
  await page.getByTestId('sut-favourite-piazza-local').click();
  await page.getByTestId('sut-favourites-filter').click();
  await expect(page.getByTestId('sut-merchant-list').getByRole('link')).toHaveText(['Piazza Local']);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('corrupted value written by another tab clears favourites without errors',async({context})=>{
  const first=await context.newPage(),second=await context.newPage();
  const errors:string[]=[];
  first.on('pageerror',e=>errors.push(e.message));
  await first.goto('/');
  await second.goto('/');
  await first.getByTestId('sut-favourite-piazza-local').click();
  await second.evaluate(k=>localStorage.setItem(k,'garbage'),key);
  await expect(first.getByTestId('sut-favourite-piazza-local')).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});

test('un-favouriting under the filter keeps focus on the merchants heading',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-favourite-green-table').click();
  await page.getByTestId('sut-favourites-filter').click();
  await page.getByTestId('sut-favourite-green-table').click();
  await expect(page.getByRole('heading',{level:2,name:'Merchants'})).toBeFocused();
});

test('favourite controls have no serious or critical axe violations',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-favourite-green-table').click();
  await page.getByTestId('sut-favourites-filter').click();
  const blocking=(v:{impact?:string|null}[])=>v.filter(x=>x.impact==='serious'||x.impact==='critical');
  const tags=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
  const list=await new AxeBuilder({page}).include('[data-testid="sut-merchant-list"]').include('[data-testid="sut-favourites-filter"]').withTags(tags).analyze();
  expect(blocking(list.violations)).toEqual([]);
  await page.getByTestId('sut-merchant-link-green-table').click();
  const detail=await new AxeBuilder({page}).include('.detailHero').withTags(tags).analyze();
  expect(blocking(detail.violations)).toEqual([]);
});
