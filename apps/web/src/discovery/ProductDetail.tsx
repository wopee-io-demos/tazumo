import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {categoryLabel,changeQuantity,findProduct,formatLocalizedPrice,merchantForProduct,removeFromCart,t,type Cart,type Language} from '@tazumo/core';
import {cartKey,priceSelection,validateSelection,type Selection} from '@tazumo/product-options';
import {Breadcrumbs,NotFound,QuantityStepper,useRouteFocus} from './common';
import {OptionPicker} from './OptionPicker';
import {cartProduct} from './options';
import {homeHref,merchantHref} from './route';

type Props={lang:Language;id:string;cart:Cart;onCartChange:Dispatch<SetStateAction<Cart>>};

const initialSelection=(id:string):Selection=>{
  const options=cartProduct(id)?.options;
  const defaults=options&&validateSelection(options,{});
  return defaults?.ok?defaults.selection:{};
};

export function ProductDetail({lang,id,cart,onCartChange}:Props){
  const product=findProduct(id),item=cartProduct(id);
  const heading=useRouteFocus(id);
  const price=(next:Selection)=>item&&priceSelection(item.options??{productId:item.id,currency:item.basePrice.currency,groups:[]},item.basePrice,next,1);
  const [selection,setSelection]=useState<Selection>(()=>initialSelection(id));
  const priced=price(selection);
  const [lastPrice,setLastPrice]=useState(()=>priced?.ok?priced.unitPrice.minorUnits:product?.priceCents??0);
  const select=(next:Selection)=>{const result=price(next);setSelection(next);if(result?.ok)setLastPrice(result.unitPrice.minorUnits)};
  const key=item&&priced?.ok?cartKey(item,priced.selection):undefined;
  const quantity=key?cart[key]??0:0;
  const actions=useRef<HTMLDivElement>(null),previous=useRef({key,quantity});
  useEffect(()=>{
    const before=previous.current;previous.current={key,quantity};
    if(before.key===key&&(before.quantity===0)!==(quantity===0))actions.current?.querySelector<HTMLButtonElement>(quantity>0?'[data-testid^="sut-detail-increase"]':'button')?.focus();
  },[key,quantity]);
  if(!product||!item||!priced)return <NotFound lang={lang} routeKey={id} message={t(lang,'productNotFound')} testId="sut-detail-not-found"/>;
  const merchant=merchantForProduct(product);
  const change=(delta:number)=>{if(key)onCartChange(c=>changeQuantity(c,key,delta))};
  return <article className="detail" data-testid="sut-detail-product">
    <Breadcrumbs lang={lang} trail={[...(merchant?[{label:merchant.name,href:merchantHref(merchant.id)}]:[]),{label:product.name}]}/>
    <div className="detailHero">
      <span className="detailEmoji" aria-hidden="true">{product.emoji}</span>
      <div>
        <p className="kicker">{categoryLabel(lang,product.category)}</p>
        <h1 ref={heading} tabIndex={-1}>{product.name}</h1>
        {merchant&&<p>{t(lang,'soldBy')} <a href={merchantHref(merchant.id)} data-testid="sut-detail-merchant-link">{merchant.name}</a></p>}
        <p>{product.description}</p>
        {item.options&&<OptionPicker lang={lang} definition={item.options} selection={selection} errors={priced.ok?[]:priced.errors} onChange={select}/>}
        <p className="detailPrice" data-testid="sut-detail-price" aria-live="polite">{formatLocalizedPrice(lastPrice,lang)}</p>
        <div ref={actions} className="detailActions">{quantity===0
          ?<button type="button" className="primaryAction" data-testid={`sut-add-${product.id}`} aria-label={`${t(lang,'add')} ${product.name}`} disabled={!key} onClick={()=>change(1)}>{t(lang,'add')}</button>
          :<div className="inBasketRow"><span>{t(lang,'inBasket')}</span><QuantityStepper lang={lang} name={product.name} idKey={product.id} quantity={quantity} testIdPrefix="sut-detail" onChange={change} onRemove={()=>onCartChange(c=>removeFromCart(c,key!))}/></div>}</div>
        <small>{t(lang,'demo')}</small>
      </div>
    </div>
    <a className="detailBack" href={merchant?merchantHref(merchant.id):homeHref} data-testid="sut-back-link">← {merchant?merchant.name:t(lang,'backToMerchants')}</a>
  </article>;
}
