import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {brandName,palettes,preferredPalette,type PaletteName} from '@tazumo/brand';
import {products,categories,filterProducts,changeQuantity,cartCount,cartTotal,formatLocalizedPrice,t,categoryLabel,languages,type Language,type Category,type Cart} from '@tazumo/core';
import './style.css';
function App(){
 const [lang,setLang]=useState<Language>('en');
 const [palette,setPalette]=useState<PaletteName>(preferredPalette),[category,setCategory]=useState<Category|'All'>('All'),[query,setQuery]=useState(''),[cart,setCart]=useState<Cart>({}),[cartOpen,setCartOpen]=useState(false);
 const theme=palettes[palette];
 const cartOpener=useRef<HTMLButtonElement>(null),cartDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{document.documentElement.lang=lang;},[lang]);
 useEffect(()=>{const dialog=cartDialog.current;if(!dialog)return;
  if(cartOpen&&!dialog.open){dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-cart-close]')?.focus();}
  else if(!cartOpen&&dialog.open){dialog.close();cartOpener.current?.focus();}
 },[cartOpen]);
 const visible=useMemo(()=>filterProducts(products,query,category),[query,category]);
 const itemCount=cartCount(cart);
 return <div className="app" style={{'--primary':theme.primary,'--accent':theme.accent,'--tint':theme.background,'--ink':theme.ink} as React.CSSProperties}>
  <header className="top"><a href="/" className="logo" aria-label="Tazumo home"><span className="logo-mark">✦</span>{brandName.toLowerCase()}<span className="dot">.</span></a><div className="delivery">📍 <span>{t(lang,'city')}</span></div><button ref={cartOpener} className="cartButton" onClick={()=>setCartOpen(true)} aria-label={`${t(lang,'cart')}, ${itemCount}`}>🛍️ {t(lang,'cart')} <span className="counter">{itemCount}</span></button></header>
  <main><section className="hero"><div className="heroContent"><div className="eyebrow">{t(lang,'eyebrow')}</div><h1>{t(lang,'heroStart')}<br/><em>{t(lang,'heroEnd')}</em></h1><p>{t(lang,'intro')}</p><div className="search"><span>⌕</span><input aria-label={t(lang,'search')} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t(lang,'search')}/></div><small>{t(lang,'demo')}</small></div><div className="heroArt" aria-hidden="true"><span className="fox">🦊</span><div className="bubble">Hello, neighbour! ✨</div></div></section>
  <section className="content"><div className="heading"><div><p className="kicker">SHOP LOCAL</p><h2>{t(lang,'section')}</h2></div><div className="palette"><label htmlFor="language">{t(lang,'language')}</label><select id="language" value={lang} onChange={e=>setLang(e.target.value as Language)}>{languages.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select><label htmlFor="palette">{t(lang,'color')}</label><select id="palette" value={palette} onChange={e=>setPalette(e.target.value as PaletteName)}>{Object.keys(palettes).map(x=><option key={x} value={x}>{x}</option>)}</select></div></div>
  <div className="categories"><button className={category==='All'?'active':''} onClick={()=>setCategory('All')}>✨ {t(lang,'everything')}</button>{categories.map((c,i)=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{['🍽️','🛒','🛍️','🎁'][i]} {categoryLabel(lang,c)}</button>)}</div>
  <div className="products">{visible.map(p=><article className="product" key={p.id}><div className="productImage" aria-hidden="true">{p.emoji}</div><div className="productBody"><p className="merchant">{p.merchant} · {categoryLabel(lang,p.category)}</p><h3>{p.name}</h3><p className="description">{p.description}</p><div className="productBottom"><strong>{formatLocalizedPrice(p.priceCents,lang)}</strong><button aria-label={`${t(lang,'add')} ${p.name}`} onClick={()=>setCart(c=>changeQuantity(c,p.id,1))}>{t(lang,'add')}</button></div></div></article>)}</div>
  {visible.length===0&&<p role="status" className="empty">{t(lang,'empty')}</p>}</section></main>
  <footer><strong>{brandName}</strong><span>Local discovery prototype · No real orders or payments are processed.</span></footer>
  <dialog ref={cartDialog} className="cartDialog" aria-labelledby="cart-title" onClose={()=>setCartOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setCartOpen(false)}}><div className="drawer"><div className="drawerHeading"><h2 id="cart-title">{t(lang,'basket')} 🛍️</h2><button data-cart-close aria-label={t(lang,'closeCart')} onClick={()=>setCartOpen(false)}>✕</button></div>{itemCount===0?<p>{t(lang,'emptyBasket')}</p>:<>{products.filter(p=>(cart[p.id]??0)>0).map(p=><div className="cartLine" key={p.id}><div><strong>{p.name}</strong><small>{formatLocalizedPrice(p.priceCents,lang)}</small></div><div className="stepper"><button aria-label={`${t(lang,'removeOne')} ${p.name}`} onClick={()=>setCart(c=>changeQuantity(c,p.id,-1))}>−</button><span>{cart[p.id]}</span><button aria-label={`${t(lang,'addOne')} ${p.name}`} onClick={()=>setCart(c=>changeQuantity(c,p.id,1))}>+</button></div></div>)}<div className="total"><strong>{t(lang,'subtotal')}</strong><strong>{formatLocalizedPrice(cartTotal(cart),lang)}</strong></div><p className="disclaimer">{t(lang,'disabled')}</p><button className="disabledCheckout" disabled>{t(lang,'checkoutLater')}</button></>}</div></dialog>
 </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
