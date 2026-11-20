import {categoryLabel,findMerchant,formatLocalizedPrice,productsForMerchant,t,type Language} from '@tazumo/core';
import {Breadcrumbs,NotFound,useRouteFocus} from './common';
import {homeHref,productHref} from './route';

type Props={lang:Language;id:string;cart:Record<string,number>;onAdd:(productId:string)=>void};

export function MerchantDetail({lang,id,cart,onAdd}:Props){
  const merchant=findMerchant(id);
  const heading=useRouteFocus(id);
  if(!merchant)return <NotFound lang={lang} routeKey={id} message={t(lang,'merchantNotFound')} testId="sut-merchant-not-found"/>;
  return <article className="detail" data-testid="sut-merchant-detail">
    <Breadcrumbs lang={lang} trail={[{label:merchant.name}]}/>
    <header className="detailHero">
      <span className="detailEmoji" aria-hidden="true">{merchant.emoji}</span>
      <div><p className="kicker">{categoryLabel(lang,merchant.category)}</p><h1 ref={heading} tabIndex={-1}>{merchant.name}</h1><p>{merchant.description}</p><small>{t(lang,'demo')}</small></div>
    </header>
    <h2>{t(lang,'menu')}</h2>
    <ul className="detailProducts">{productsForMerchant(merchant).map(p=><li key={p.id} data-testid={`sut-merchant-product-${p.id}`}>
      <span className="detailEmoji small" aria-hidden="true">{p.emoji}</span>
      <div><h3><a href={productHref(p.id)} data-testid={`sut-product-link-${p.id}`}>{p.name}</a></h3><p>{p.description}</p>{(cart[p.id]??0)>0&&<p className="inBasket">{t(lang,'inBasket')}: {cart[p.id]}</p>}</div>
      <strong>{formatLocalizedPrice(p.priceCents,lang)}</strong>
      <button type="button" className="primaryAction" data-testid={`sut-add-${p.id}`} aria-label={`${t(lang,'add')} ${p.name}`} onClick={()=>onAdd(p.id)}>{t(lang,'add')}</button>
    </li>)}</ul>
    <a className="detailBack" href={homeHref} data-testid="sut-back-to-merchants">← {t(lang,'backToMerchants')}</a>
  </article>;
}
