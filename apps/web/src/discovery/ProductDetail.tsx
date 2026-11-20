import {useEffect,useRef,type Dispatch,type SetStateAction} from 'react';
import {categoryLabel,changeQuantity,findProduct,formatLocalizedPrice,merchantForProduct,removeFromCart,t,type Cart,type Language} from '@tazumo/core';
import {Breadcrumbs,NotFound,QuantityStepper,useRouteFocus} from './common';
import {homeHref,merchantHref} from './route';

type Props={lang:Language;id:string;cart:Cart;onCartChange:Dispatch<SetStateAction<Cart>>};

export function ProductDetail({lang,id,cart,onCartChange}:Props){
  const product=findProduct(id);
  const heading=useRouteFocus(id);
  const quantity=product?cart[product.id]??0:0;
  const actions=useRef<HTMLDivElement>(null),previous=useRef({id,quantity});
  useEffect(()=>{
    const before=previous.current;previous.current={id,quantity};
    if(before.id===id&&(before.quantity===0)!==(quantity===0))actions.current?.querySelector<HTMLButtonElement>(quantity>0?'[data-testid^="sut-detail-increase"]':'button')?.focus();
  },[id,quantity]);
  if(!product)return <NotFound lang={lang} routeKey={id} message={t(lang,'productNotFound')} testId="sut-detail-not-found"/>;
  const merchant=merchantForProduct(product);
  return <article className="detail" data-testid="sut-detail-product">
    <Breadcrumbs lang={lang} trail={[...(merchant?[{label:merchant.name,href:merchantHref(merchant.id)}]:[]),{label:product.name}]}/>
    <div className="detailHero">
      <span className="detailEmoji" aria-hidden="true">{product.emoji}</span>
      <div>
        <p className="kicker">{categoryLabel(lang,product.category)}</p>
        <h1 ref={heading} tabIndex={-1}>{product.name}</h1>
        {merchant&&<p>{t(lang,'soldBy')} <a href={merchantHref(merchant.id)} data-testid="sut-detail-merchant-link">{merchant.name}</a></p>}
        <p>{product.description}</p>
        <p className="detailPrice" data-testid="sut-detail-price">{formatLocalizedPrice(product.priceCents,lang)}</p>
        <div ref={actions} className="detailActions">{quantity===0
          ?<button type="button" className="primaryAction" data-testid={`sut-add-${product.id}`} aria-label={`${t(lang,'add')} ${product.name}`} onClick={()=>onCartChange(c=>changeQuantity(c,product.id,1))}>{t(lang,'add')}</button>
          :<div className="inBasketRow"><span>{t(lang,'inBasket')}</span><QuantityStepper lang={lang} product={product} quantity={quantity} testIdPrefix="sut-detail" onChange={d=>onCartChange(c=>changeQuantity(c,product.id,d))} onRemove={()=>onCartChange(c=>removeFromCart(c,product.id))}/></div>}</div>
        <small>{t(lang,'demo')}</small>
      </div>
    </div>
    <a className="detailBack" href={merchant?merchantHref(merchant.id):homeHref} data-testid="sut-back-link">← {merchant?merchant.name:t(lang,'backToMerchants')}</a>
  </article>;
}
