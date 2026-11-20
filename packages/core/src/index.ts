/** Prototype catalogue only. Never represent fixture prices or delivery estimates as live. */
export type Category = 'Food' | 'Groceries' | 'Shops' | 'Gifts';
export type Product = { id: string; merchant: string; name: string; category: Category; description: string; priceCents: number; emoji: string };
export type Cart = Record<string, number>;
export const categories: Category[] = ['Food','Groceries','Shops','Gifts'];
export const products: Product[] = [
  {id:'pizza',merchant:'Piazza Local',name:'Margherita pizza',category:'Food',description:'Tomato, mozzarella and basil',priceCents:1190,emoji:'🍕'},
  {id:'bowl',merchant:'Green Table',name:'Seasonal veggie bowl',category:'Food',description:'Fresh greens, grains and herbs',priceCents:1050,emoji:'🥗'},
  {id:'burger',merchant:'Bun & Co',name:'House burger',category:'Food',description:'Grilled patty and house sauce',priceCents:1390,emoji:'🍔'},
  {id:'bread',merchant:'Morning Market',name:'Sourdough loaf',category:'Groceries',description:'Freshly baked daily',priceCents:450,emoji:'🍞'},
  {id:'apples',merchant:'Morning Market',name:'Local apples 1 kg',category:'Groceries',description:'Crisp seasonal selection',priceCents:390,emoji:'🍎'},
  {id:'flowers',merchant:'Bloom & Grow',name:'Fresh flowers',category:'Gifts',description:'Beautiful seasonal bouquet',priceCents:1790,emoji:'💐'},
  {id:'headphones',merchant:'City Tech',name:'Wireless headphones',category:'Shops',description:'Everyday audio essentials',priceCents:3990,emoji:'🎧'},
  {id:'book',merchant:'The Corner Bookshop',name:'Weekend reading pick',category:'Shops',description:'A surprise pick from a local shop',priceCents:1290,emoji:'📚'}
];
export function filterProducts(list: Product[], query: string, category: Category | 'All'='All'): Product[] {
  const q=query.trim().toLocaleLowerCase();
  return list.filter(p=>(category==='All'||p.category===category)&&(!q||[p.name,p.merchant,p.description].some(x=>x.toLocaleLowerCase().includes(q))));
}
export function cartCount(cart:Cart):number {return Object.values(cart).reduce((sum,quantity)=>sum+Math.max(0,quantity),0)}
export function cartTotal(cart:Cart,list:Product[]=products):number {return list.reduce((sum,p)=>sum+p.priceCents*Math.max(0,cart[p.id]??0),0)}
export function changeQuantity(cart:Cart,id:string,delta:number):Cart {const next={...cart};const qty=Math.max(0,(next[id]??0)+delta);if(qty===0)delete next[id];else next[id]=qty;return next}
export function formatPrice(cents:number,locale='en-IE',currency='EUR'):string{return new Intl.NumberFormat(locale,{style:'currency',currency}).format(cents/100)}

export {languages,t,categoryLabel,formatLocalizedPrice} from './localization.ts';
export type {Language,MessageKey} from './localization.ts';
