import {test,expect,type Page} from '@playwright/test';
import {search,productHeadings,cartButton} from './support/locators';
import {products,formatPrice} from '../../packages/core/src/index.ts';

const priceCents=(id:string)=>products.find(p=>p.id===id)!.priceCents;
const price=(id:string)=>formatPrice(priceCents(id));

const pageErrors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{
  const errors:string[]=[];
  pageErrors.set(page,errors);
  page.on('pageerror',e=>errors.push(e.message));
});
test.afterEach(({page})=>{
  expect(pageErrors.get(page),'uncaught page errors').toEqual([]);
});

test.describe('no search results',()=>{
  test('a query without matches shows the empty state and no product cards, clearing restores the catalogue',async({page})=>{
    await page.goto('/');
    await expect(productHeadings(page)).toHaveCount(products.length);
    await search(page).fill('no-such-product-xyz');
    await expect(page.getByRole('status')).toHaveText('No matching products.');
    await expect(productHeadings(page)).toHaveCount(0);
    await search(page).fill('');
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(productHeadings(page)).toHaveCount(products.length);
  });

  test('a matching query inside a category without overlap is empty, a whitespace-only query is not',async({page})=>{
    await page.goto('/');
    await page.getByRole('button',{name:'Groceries'}).click();
    await search(page).fill('Piazza');
    await expect(page.getByRole('status')).toBeVisible();
    await expect(productHeadings(page)).toHaveCount(0);
    await page.getByRole('button',{name:/Everything/}).click();
    await expect(productHeadings(page)).toHaveCount(1);
    await search(page).fill('   ');
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(productHeadings(page)).toHaveCount(products.length);
  });
});

test.describe('unknown route',()=>{
  for(const path of ['/does-not-exist','/merchants/unknown/products?id=%00']){
    test(`${path} falls back to the app shell without crashing and links home`,async({page})=>{
      const response=await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.getByRole('link',{name:'Tazumo home'})).toBeVisible();
      await expect(productHeadings(page).first()).toBeVisible();
      await page.getByRole('link',{name:'Tazumo home'}).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(productHeadings(page)).toHaveCount(products.length);
    });
  }
});

test.describe('cart edge cases',()=>{
  test('decrementing one line to zero removes only that line, never goes negative and keeps checkout disabled',async({page})=>{
    await page.goto('/');
    const addPizza=page.getByRole('button',{name:'Add Margherita pizza'});
    await addPizza.click();
    await addPizza.click();
    await addPizza.click();
    await page.getByRole('button',{name:'Add Sourdough loaf'}).click();
    await cartButton(page,4).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toContainText(formatPrice(priceCents('pizza')*3+priceCents('bread')));
    await expect(dialog.getByRole('button',{name:'Checkout coming later'})).toBeDisabled();

    const removePizza=dialog.getByRole('button',{name:'Remove one Margherita pizza'});
    for(let i=0;i<3;i++)await removePizza.click();
    await expect(removePizza).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'Remove one Sourdough loaf'})).toBeVisible();
    await expect(dialog).toContainText(price('bread'));
    await expect(dialog).not.toContainText('Margherita pizza');
    await expect(dialog.getByRole('button',{name:'Checkout coming later'})).toBeDisabled();

    await dialog.getByRole('button',{name:'Remove one Sourdough loaf'}).click();
    await expect(dialog.getByText('Your basket is empty.',{exact:false})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Checkout coming later'})).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(cartButton(page,0)).toBeVisible();
  });

  test('the cart survives filtering away its products',async({page})=>{
    await page.goto('/');
    await page.getByRole('button',{name:'Add Wireless headphones'}).click();
    await search(page).fill('no-such-product-xyz');
    await expect(productHeadings(page)).toHaveCount(0);
    await cartButton(page,1).click();
    await expect(page.getByRole('dialog')).toContainText('Wireless headphones');
    await expect(page.getByRole('dialog')).toContainText(price('headphones'));
  });
});
