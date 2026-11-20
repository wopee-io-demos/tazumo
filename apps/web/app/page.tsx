"use client";
import { useEffect, useMemo, useState } from "react";
import { categories, items, merchants, addItem, removeItem, money, subtotal, type CartLine, type Category } from "@tazumo/catalog";
import { brand, palettePresets, defaultPalette, type PaletteId } from "@tazumo/brand";

export default function Home() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [palette, setPalette] = useState<PaletteId>(defaultPalette);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tazumo-cart-v1");
      if (stored) {
        const data: unknown = JSON.parse(stored);
        if (Array.isArray(data)) setCart(data.filter((line): line is CartLine => typeof line?.itemId === "string" && Number.isInteger(line?.quantity) && line.quantity > 0 && items.some(i => i.id === line.itemId)));
      }
      const theme = localStorage.getItem("tazumo-palette");
      if (theme && theme in palettePresets) setPalette(theme as PaletteId);
    } catch { /* corrupted client storage should not prevent rendering */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("tazumo-cart-v1", JSON.stringify(cart)); }, [cart, ready]);
  useEffect(() => { if (ready) localStorage.setItem("tazumo-palette", palette); }, [palette, ready]);
  const filtered = useMemo(() => items.filter(i => (category === "all" || i.category === category) && [i.title, i.description, merchants.find(m => m.id === i.merchantId)?.name ?? ""].join(" ").toLowerCase().includes(query.toLowerCase())), [category, query]);
  const theme = palettePresets[palette];
  return <div style={{ "--primary": theme.primary, "--surface": theme.surface } as React.CSSProperties}>
    <main className="page">
      <header className="nav"><span className="logo">{brand.candidateName.toLowerCase()}.</span><span className="muted">📍 Your city</span><a href="#cart" className="pill" style={{textDecoration:"none"}}>🛍️ Cart ({cart.reduce((n,l)=>n+l.quantity,0)})</a></header>
      <section className="hero"><div><p style={{fontWeight:700,marginTop:0}}>A LITTLE MORE JOY, DELIVERED</p><h1>Good things<br/>are closer.</h1><p>From neighbourhood favourites to everyday essentials. Discover what your city has to offer.</p><a href="#discover" className="pill" style={{display:"inline-block",background:"white",color:theme.ink,textDecoration:"none",marginTop:12}}>Explore your city →</a></div><div className="fox" aria-label="Friendly fox brand concept" role="img">🦊</div></section>
      <div className="notice" role="status">Prototype catalogue. Prices and merchants are fictional; ordering and payments are not live.</div>
      <section aria-label="Brand color exploration"><div className="sectionhead"><h2>Make it yours</h2><span className="muted">Try a color direction</span></div><div className="colors">{(Object.entries(palettePresets) as [PaletteId, typeof theme][]).map(([id,p])=><button key={id} className="swatch" aria-label={p.name} aria-pressed={palette===id} title={p.name} style={{background:p.primary}} onClick={()=>setPalette(id)}/>)}</div></section>
      <section id="discover"><div className="sectionhead"><h2>Explore everything</h2><span className="muted">{filtered.length} picks</span></div><div className="categories"><button className="category" aria-pressed={category==="all"} onClick={()=>setCategory("all")}>✨ All</button>{categories.map(c=><button key={c.id} className="category" aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.emoji} {c.label}</button>)}</div><label htmlFor="search" className="muted">Search your city</label><input id="search" className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search food, groceries, shops..."/><div className="grid">{filtered.map(i=><article className="product" key={i.id}><div className="product-art" aria-hidden="true">{i.emoji}</div><div className="product-body"><span className="muted">{merchants.find(m=>m.id===i.merchantId)?.name}</span><h3>{i.title}</h3><p className="muted">{i.description}</p><div className="price-row"><strong>{money(i.priceCents)}</strong><button className="small-button" aria-label={"Add "+i.title+" to cart"} onClick={()=>setCart(c=>addItem(c,i.id))}>+ Add</button></div></div></article>)}</div>{filtered.length===0&&<p>No matches. Try another search.</p>}</section>
      <section id="cart" className="cart"><div className="sectionhead"><h2>Your basket</h2><strong>{money(subtotal(cart))}</strong></div>{cart.length===0?<p className="muted">Your next favourite is only a tap away.</p>:cart.map(l=>{const i=items.find(p=>p.id===l.itemId);if(!i)return null;return <div key={l.itemId} className="cartline"><span>{i.emoji} {i.title}</span><div className="controls"><button className="small-button" aria-label={"Remove one "+i.title} onClick={()=>setCart(c=>removeItem(c,i.id))}>−</button><strong>{l.quantity}</strong><button className="small-button" aria-label={"Add one "+i.title} onClick={()=>setCart(c=>addItem(c,i.id))}>+</button><span>{money(i.priceCents*l.quantity)}</span></div></div>})}<p className="muted">Checkout is intentionally disabled until a real merchant, payment and fulfilment backend is implemented.</p><button className="pill" disabled style={{opacity:.5,cursor:"not-allowed"}}>Checkout coming later</button></section>
      <footer className="footer">© Tazumo concept · Brand name, colors and mascot remain provisional · No affiliation with Foodora</footer>
    </main>
  </div>;
}
