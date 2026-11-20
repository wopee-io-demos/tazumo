/** Synthetic merchant fixtures for discovery screens. Not real businesses, opening hours or delivery estimates. */
import {products,type Cart,type Category,type Product} from './index.ts';

export type Merchant = { id: string; name: string; category: Category; description: string; emoji: string };
export type CartLine = { product: Product; quantity: number; lineTotalMinor: number };

export const merchants: Merchant[] = [
  {id:'piazza-local',name:'Piazza Local',category:'Food',description:'Neighbourhood pizzeria with wood-fired classics',emoji:'🍕'},
  {id:'green-table',name:'Green Table',category:'Food',description:'Plant-forward bowls and salads',emoji:'🥗'},
  {id:'bun-and-co',name:'Bun & Co',category:'Food',description:'Burgers and comfort food',emoji:'🍔'},
  {id:'morning-market',name:'Morning Market',category:'Groceries',description:'Bakery and fresh produce corner shop',emoji:'🧺'},
  {id:'bloom-and-grow',name:'Bloom & Grow',category:'Gifts',description:'Florist with seasonal bouquets',emoji:'💐'},
  {id:'city-tech',name:'City Tech',category:'Shops',description:'Everyday electronics and accessories',emoji:'🎧'},
  {id:'corner-bookshop',name:'The Corner Bookshop',category:'Shops',description:'Independent bookshop with staff picks',emoji:'📚'}
];

const matches=(q:string,...fields:string[])=>!q||fields.some(f=>f.toLocaleLowerCase().includes(q));

export const findMerchant=(id:string,list:Merchant[]=merchants):Merchant|undefined=>list.find(m=>m.id===id);
export const findProduct=(id:string,list:Product[]=products):Product|undefined=>list.find(p=>p.id===id);
export const merchantForProduct=(product:Product,list:Merchant[]=merchants):Merchant|undefined=>list.find(m=>m.name===product.merchant);
export const productsForMerchant=(merchant:Merchant,list:Product[]=products):Product[]=>list.filter(p=>p.merchant===merchant.name);

export function filterMerchants(query:string,category:Category|'All'='All',list:Merchant[]=merchants,catalogue:Product[]=products):Merchant[] {
  const q=query.trim().toLocaleLowerCase();
  return list.filter(m=>(category==='All'||m.category===category)&&(matches(q,m.name,m.description)||productsForMerchant(m,catalogue).some(p=>matches(q,p.name,p.description))));
}

export function setQuantity(cart:Cart,id:string,quantity:number):Cart {
  const next={...cart};
  const qty=Number.isFinite(quantity)?Math.max(0,Math.trunc(quantity)):0;
  if(qty===0)delete next[id];else next[id]=qty;
  return next;
}
export const removeFromCart=(cart:Cart,id:string):Cart=>setQuantity(cart,id,0);

export function cartLines(cart:Cart,list:Product[]=products):CartLine[] {
  return list.filter(p=>(cart[p.id]??0)>0).map(p=>({product:p,quantity:cart[p.id],lineTotalMinor:p.priceCents*cart[p.id]}));
}
