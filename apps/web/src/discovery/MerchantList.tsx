import {useEffect,useMemo,useRef} from 'react';
import {categoryLabel,filterMerchants,productsForMerchant,t,type Category,type Language} from '@tazumo/core';
import {hasNavigated,merchantHref} from './route';

type Props={lang:Language;query:string;category:Category|'All';onReset:()=>void};

export function MerchantList({lang,query,category,onReset}:Props){
  const list=useMemo(()=>filterMerchants(query,category),[query,category]);
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
    </li>)}</ul>:<div className="discoveryEmpty" data-testid="sut-merchants-empty">
      <p>{t(lang,'noMerchants')} {t(lang,'noResultsHint')}</p>
      <button type="button" data-testid="sut-search-reset" onClick={onReset}>{t(lang,'resetSearch')}</button>
    </div>}
  </section>;
}
