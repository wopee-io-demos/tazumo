import {useMemo} from 'react';
import {categoryLabel,filterMerchants,productsForMerchant,t,type Category,type Language} from '@tazumo/core';
import {merchantHref} from './route';

type Props={lang:Language;query:string;category:Category|'All';onReset:()=>void};

export function MerchantList({lang,query,category,onReset}:Props){
  const list=useMemo(()=>filterMerchants(query,category),[query,category]);
  return <section className="merchantSection" aria-labelledby="merchants-title" data-testid="sut-merchant-list">
    <h2 id="merchants-title">{t(lang,'merchants')}</h2>
    {list.length>0?<ul className="merchantList">{list.map(m=><li key={m.id} className="merchantCard" data-testid={`sut-merchant-${m.id}`}>
      <span className="merchantEmoji" aria-hidden="true">{m.emoji}</span>
      <div>
        <h3><a href={merchantHref(m.id)} data-testid={`sut-merchant-link-${m.id}`}>{m.name}</a></h3>
        <p>{categoryLabel(lang,m.category)} · {m.description}</p>
        <p className="merchantMeta">{t(lang,'menu')}: {productsForMerchant(m).length}</p>
      </div>
    </li>)}</ul>:<div className="discoveryEmpty" data-testid="sut-merchants-empty">
      <p role="status">{t(lang,'noMerchants')} {t(lang,'noResultsHint')}</p>
      <button type="button" data-testid="sut-search-reset" onClick={onReset}>{t(lang,'resetSearch')}</button>
    </div>}
  </section>;
}
