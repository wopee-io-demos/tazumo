import {useEffect,useRef,type Dispatch,type RefObject,type SetStateAction} from 'react';
import {cartLines,cartTotal,changeQuantity,formatLocalizedPrice,removeFromCart,t,type Cart,type Language} from '@tazumo/core';
import {QuantityStepper} from './common';

type Props={lang:Language;cart:Cart;onCartChange:Dispatch<SetStateAction<Cart>>;open:boolean;onClose:()=>void;openerRef:RefObject<HTMLButtonElement|null>};

export function CartDrawer({lang,cart,onCartChange,open,onClose,openerRef}:Props){
  const dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const lines=cartLines(cart);
  const lineCount=useRef(lines.length);
  useEffect(()=>{const el=dialog.current;if(!el)return;
    if(open&&!el.open){el.showModal();el.querySelector<HTMLButtonElement>('[data-cart-close]')?.focus();}
    else if(!open&&el.open){el.close();openerRef.current?.focus();}
  },[open,openerRef]);
  useEffect(()=>{if(open&&lines.length<lineCount.current)heading.current?.focus();lineCount.current=lines.length;},[open,lines.length]);
  return <dialog data-testid="sut-cart-dialog" ref={dialog} className="cartDialog" aria-labelledby="cart-title" onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="drawer">
    <div className="drawerHeading"><h2 id="cart-title" ref={heading} tabIndex={-1}>{t(lang,'basket')} 🛍️</h2><button type="button" data-cart-close data-testid="sut-cart-close" aria-label={t(lang,'closeCart')} onClick={onClose}>✕</button></div>
    {lines.length===0?<p data-testid="sut-cart-empty">{t(lang,'emptyBasket')}</p>:<>
      <ul className="cartLines">{lines.map(({product:p,quantity,lineTotalMinor})=><li className="cartLine" key={p.id} data-testid={`sut-cart-line-${p.id}`}>
        <div><strong>{p.name}</strong><small>{formatLocalizedPrice(p.priceCents,lang)}</small></div>
        <QuantityStepper lang={lang} product={p} quantity={quantity} testIdPrefix="sut-cart" onChange={d=>onCartChange(c=>changeQuantity(c,p.id,d))} onRemove={()=>onCartChange(c=>removeFromCart(c,p.id))}/>
        <strong className="lineTotal" data-testid={`sut-cart-line-total-${p.id}`}><span className="visuallyHidden">{t(lang,'lineTotal')}: </span>{formatLocalizedPrice(lineTotalMinor,lang)}</strong>
      </li>)}</ul>
      <div className="total"><strong>{t(lang,'subtotal')}</strong><strong data-testid="sut-cart-subtotal">{formatLocalizedPrice(cartTotal(cart),lang)}</strong></div>
      <p className="disclaimer">{t(lang,'disabled')}</p>
      <button type="button" className="disabledCheckout" data-testid="sut-checkout-disabled" disabled>{t(lang,'checkoutLater')}</button>
    </>}
  </div></dialog>;
}
