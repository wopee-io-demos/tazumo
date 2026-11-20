import {changeQuantity,products,type Cart,type Product} from '@tazumo/core';

export type Route={name:'catalogue'}|{name:'product';productId:string}|{name:'cart'};
export type CartLine={product:Product;quantity:number};

export const initialStack:Route[]=[{name:'catalogue'}];

const sameRoute=(a:Route,b:Route)=>a.name===b.name&&(a.name!=='product'||b.name!=='product'||a.productId===b.productId);

export function pushRoute(stack:Route[],route:Route):Route[]{
 const top=stack[stack.length-1];
 return top&&sameRoute(top,route)?stack:[...stack,route];
}

export function popRoute(stack:Route[]):Route[]{
 return stack.length>1?stack.slice(0,-1):stack;
}

export function findProduct(id:string,list:Product[]=products):Product|undefined{
 return list.find(p=>p.id===id);
}

export function cartLines(cart:Cart,list:Product[]=products):CartLine[]{
 return list.filter(p=>(cart[p.id]??0)>0).map(p=>({product:p,quantity:cart[p.id]}));
}

export function removeLine(cart:Cart,id:string):Cart{
 return changeQuantity(cart,id,-(cart[id]??0));
}
