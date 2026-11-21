import type {Page} from '@playwright/test';

export const search=(page:Page)=>page.getByRole('searchbox').or(page.getByRole('textbox',{name:/looking for/i})).first();
export const productHeadings=(page:Page)=>page.getByRole('main').getByRole('heading',{level:3});
export const cartButton=(page:Page,count:number)=>page.getByRole('button',{name:new RegExp(`^Cart, ${count}$`)});
