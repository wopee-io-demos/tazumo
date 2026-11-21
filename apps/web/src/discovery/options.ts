import {findProduct,formatLocalizedPrice,type Cart,type Language} from '@tazumo/core';
import {priceCartLines,type CartProduct,type PricedCartLine} from '@tazumo/product-options';
import {syntheticOptionLabel,syntheticOptionsFor} from '@tazumo/product-options/fixtures';

export function cartProduct(id:string):CartProduct|undefined{
  const product=findProduct(id);
  return product&&{id:product.id,basePrice:{currency:'EUR',minorUnits:product.priceCents},options:syntheticOptionsFor(product.id)};
}

export const optionLabel=(lang:Language,labelKey:string)=>syntheticOptionLabel(lang,labelKey);
export const pricedCart=(cart:Cart):PricedCartLine[]=>priceCartLines(cart,cartProduct);
export const optionSummary=(lang:Language,line:Pick<PricedCartLine,'breakdown'>)=>line.breakdown.map(entry=>optionLabel(lang,entry.labelKey)).join(', ');
export const formatDelta=(minor:number,lang:Language)=>`${minor<0?'−':'+'}${formatLocalizedPrice(Math.abs(minor),lang)}`;
