import {useEffect,useMemo,useRef} from 'react';
import {categoryLabel,filterMerchants,productsForMerchant,t,type Category,type Language} from '@tazumo/core';
import {FavouriteButton} from './favourites';
import {hasNavigated,merchantHref} from './route';

type Props={lang:Language;query:string;category:Category|'All';favourites:string[];favouritesOnly:boolean;onToggleFavourite:(id:string)=>void;onReset:()=>void};

export function MerchantList({lang,query,category,favourites,favouritesOnly,onToggleFavourite,onReset}:Props){
  const list=useMemo(()=>filterMerchants(query,category).filter(m=>!favouritesOnly||favourites.includes(m.id)),[query,category,favourites,favouritesOnly]);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(hasNavigated())heading.current?.focus();},[]);
  return <section className="merchantSection" aria-labelledby="merchants-title" data-testid="sut-merchant-list">
    <h2 id="merchants-title" ref={heading} tabIndex={-1}>{t(lang,'merchants')}</h2>
    {list.length>0?<ul className="merchantList">{list.map(m=><li key={m.id} className="merchantCard" data-testid={`sut-merchant-${m.id}`}>
      <span className="merchantEmoji" aria-hidden="true">{m.emoji}</span>
      <div>
        <p className="merchantName"><a href={merchantHref(m.id)} data-testid={`sut-merchant-link-${m.id}`}>{m.name}</a></p>
        <p>{categoryLabel(lang,m.category)} · {m.description}</p>
        <p className="merchantMeta">{t(lang,'menu')}: {productsForMerchant(m).length}</p>
      </div>
      <FavouriteButton lang={lang} merchant={m} on={favourites.includes(m.id)} onToggle={onToggleFavourite}/>
    </li>)}</ul>:<div className="discoveryEmpty" data-testid="sut-merchants-empty">
      <p>{favouritesOnly&&favourites.length===0?t(lang,'noFavourites'):`${t(lang,'noMerchants')} ${t(lang,'noResultsHint')}`}</p>
      <button type="button" data-testid="sut-search-reset" onClick={onReset}>{t(lang,'resetSearch')}</button>
    </div>}
  </section>;
}
