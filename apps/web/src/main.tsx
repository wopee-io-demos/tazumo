import React,{useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {brandName,palettes,preferredPalette,type PaletteName} from '@tazumo/brand';
import {products,categories,filterProducts,changeQuantity,cartCount,formatLocalizedPrice,t,categoryLabel,type Category,type Cart} from '@tazumo/core';
import './style.css';
import './discovery/discovery.css';
import {CartDrawer} from './discovery/CartDrawer';
import {MerchantList} from './discovery/MerchantList';
import {MerchantDetail} from './discovery/MerchantDetail';
import {ProductDetail} from './discovery/ProductDetail';
import {productHref,useHashRoute} from './discovery/route';
import {useDocumentTitle} from './discovery/documentTitle';
import './i18n/i18n.css';
import {LanguageSwitcher} from './i18n/LanguageSwitcher';
import {useLanguage} from './i18n/useLanguage';
function App(){
 const [lang,setLang]=useLanguage();
 const [palette,setPalette]=useState<PaletteName>(preferredPalette),[category,setCategory]=useState<Category|'All'>('All'),[query,setQuery]=useState(''),[cart,setCart]=useState<Cart>({}),[cartOpen,setCartOpen]=useState(false);
 const theme=palettes[palette];
 const cartOpener=useRef<HTMLButtonElement>(null);
 const visible=useMemo(()=>filterProducts(products,query,category),[query,category]);
 const itemCount=cartCount(cart);
 const route=useHashRoute();
 useDocumentTitle(route,lang);
 return <div className="app" style={{'--primary':theme.primary,'--accent':theme.accent,'--tint':theme.background,'--ink':theme.ink} as React.CSSProperties}>
  <header className="top"><a href="#/" className="logo" aria-label="Tazumo home"><span className="logo-mark">✦</span>{brandName.toLowerCase()}<span className="dot">.</span></a><div className="delivery">📍 <span>{t(lang,'city')}</span></div><div className="headerActions"><button ref={cartOpener} className="cartButton" onClick={()=>setCartOpen(true)} aria-label={`${t(lang,'cart')}, ${itemCount}`}>🛍️ {t(lang,'cart')} <span className="counter">{itemCount}</span></button><LanguageSwitcher lang={lang} onChange={setLang}/></div></header>
  <main>{route.name==='merchant'?<MerchantDetail lang={lang} id={route.id} cart={cart} onAdd={id=>setCart(c=>changeQuantity(c,id,1))}/>:route.name==='product'?<ProductDetail lang={lang} id={route.id} cart={cart} onCartChange={setCart}/>:<><section className="hero"><div className="heroContent"><div className="eyebrow">{t(lang,'eyebrow')}</div><h1>{t(lang,'heroStart')}<br/><em>{t(lang,'heroEnd')}</em></h1><p>{t(lang,'intro')}</p><div className="search"><span>⌕</span><input aria-label={t(lang,'search')} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t(lang,'search')}/></div><small>{t(lang,'demo')}</small></div><div className="heroArt" aria-hidden="true"><span className="fox">🦊</span><div className="bubble">Hello, neighbour! ✨</div></div></section>
  <section className="content"><div className="heading"><div><p className="kicker">SHOP LOCAL</p><h2>{t(lang,'section')}</h2></div><div className="palette"><label htmlFor="palette">{t(lang,'color')}</label><select id="palette" value={palette} onChange={e=>setPalette(e.target.value as PaletteName)}>{Object.keys(palettes).map(x=><option key={x} value={x}>{x}</option>)}</select></div></div>
  <div className="categories"><button data-testid="sut-category-all" aria-pressed={category==='All'} className={category==='All'?'active':''} onClick={()=>setCategory('All')}>✨ {t(lang,'everything')}</button>{categories.map((c,i)=><button key={c} data-testid={`sut-category-${c.toLowerCase()}`} aria-pressed={category===c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{['🍽️','🛒','🛍️','🎁'][i]} {categoryLabel(lang,c)}</button>)}</div>
  <div className="products">{visible.map(p=><article className="product" key={p.id}><div className="productImage" aria-hidden="true">{p.emoji}</div><div className="productBody"><p className="merchant">{p.merchant} · {categoryLabel(lang,p.category)}</p><h3><a data-testid={`sut-product-link-${p.id}`} href={productHref(p.id)}>{p.name}</a></h3><p className="description">{p.description}</p><div className="productBottom"><strong>{formatLocalizedPrice(p.priceCents,lang)}</strong><button aria-label={`${t(lang,'add')} ${p.name}`} onClick={()=>setCart(c=>changeQuantity(c,p.id,1))}>{t(lang,'add')}</button></div></div></article>)}</div>
  {visible.length===0&&<p role="status" className="empty">{t(lang,'empty')}</p>}<MerchantList lang={lang} query={query} category={category} onReset={()=>{setQuery('');setCategory('All')}}/></section></>}</main>
  <footer><strong>{brandName}</strong><span>Local discovery prototype · No real orders or payments are processed.</span></footer>
  <CartDrawer lang={lang} cart={cart} onCartChange={setCart} open={cartOpen} onClose={()=>setCartOpen(false)} openerRef={cartOpener}/>
 </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
