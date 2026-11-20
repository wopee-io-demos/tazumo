import { useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { categories, items, merchants, money, addItem, removeItem, subtotal, type Category, type CartLine } from "@tazumo/catalog";
import { brand, palettePresets, defaultPalette, type PaletteId } from "@tazumo/brand";
export default function Home() {
  const [tab, setTab] = useState<"browse" | "cart">("browse");
  const [category, setCategory] = useState<Category|"all">("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [palette, setPalette] = useState<PaletteId>(defaultPalette);
  const t = palettePresets[palette];
  const filtered = useMemo(()=>items.filter(i=>(category==="all" || i.category===category) && [i.title,i.description].join(" ").toLowerCase().includes(query.toLowerCase())),[category,query]);
  const count = cart.reduce((n,l)=>n+l.quantity,0);
  return <SafeAreaView style={[styles.root,{backgroundColor:t.surface}]}>
    <View style={styles.header}><Text style={[styles.logo,{color:t.primary}]}>{brand.candidateName.toLowerCase()}.</Text><Text style={styles.location}>📍 Your city</Text></View>
    <ScrollView style={{flex:1}} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {tab==="browse" ? <>
        <View style={[styles.hero,{backgroundColor:t.primary}]}><Text style={styles.eyebrow}>A LITTLE MORE JOY, DELIVERED</Text><Text style={styles.heroTitle}>Good things\nare closer. 🦊</Text><Text style={styles.heroCaption}>Your city. Your favourites. Everything in one place.</Text></View>
        <Text style={styles.notice}>Demo catalogue only. No live orders or payments.</Text>
        <Text style={styles.h2}>Choose your vibe</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>{(Object.entries(palettePresets) as [PaletteId,typeof t][]).map(([id,p])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={p.name} accessibilityState={{selected:palette===id}} onPress={()=>setPalette(id)} style={[styles.swatch,{backgroundColor:p.primary,borderWidth:palette===id?3:0,borderColor:t.ink}]} />)}</ScrollView>
        <Text style={styles.h2}>Explore everything</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}><Pressable onPress={()=>setCategory("all")} style={[styles.chip,{backgroundColor:category==="all"?t.primary:"white"}]}><Text style={{color:category==="all"?"white":t.ink}}>✨ All</Text></Pressable>{categories.map(c=><Pressable key={c.id} onPress={()=>setCategory(c.id)} style={[styles.chip,{backgroundColor:category===c.id?t.primary:"white"}]}><Text style={{color:category===c.id?"white":t.ink}}>{c.emoji} {c.label}</Text></Pressable>)}</ScrollView>
        <TextInput placeholder="Search food, groceries, shops…" placeholderTextColor="#777" accessibilityLabel="Search items" value={query} onChangeText={setQuery} style={styles.search}/>
        {filtered.map(i=><View key={i.id} style={styles.item}><Text style={styles.art}>{i.emoji}</Text><View style={{flex:1}}><Text style={styles.merchant}>{merchants.find(m=>m.id===i.merchantId)?.name}</Text><Text style={styles.itemTitle}>{i.title}</Text><Text style={styles.desc}>{i.description}</Text><View style={styles.itemBottom}><Text style={styles.price}>{money(i.priceCents)}</Text><Pressable accessibilityLabel={"Add "+i.title} onPress={()=>setCart(c=>addItem(c,i.id))} style={[styles.add,{backgroundColor:t.primary}]}><Text style={styles.addText}>+ Add</Text></Pressable></View></View></View>)}
        {filtered.length===0&&<Text>No results. Try another search.</Text>}
      </>:<>
        <Text style={styles.h2}>Your basket</Text>
        {cart.length===0?<Text style={styles.desc}>Your basket is empty. Find something wonderful.</Text>:cart.map(l=>{const i=items.find(i=>i.id===l.itemId);if(!i)return null;return <View key={l.itemId} style={styles.item}><Text style={styles.art}>{i.emoji}</Text><View style={{flex:1}}><Text style={styles.itemTitle}>{i.title}</Text><Text style={styles.desc}>{money(i.priceCents*l.quantity)}</Text><View style={styles.itemBottom}><Pressable accessibilityLabel={"Remove "+i.title} onPress={()=>setCart(c=>removeItem(c,i.id))} style={[styles.add,{backgroundColor:t.primary}]}><Text style={styles.addText}>−</Text></Pressable><Text>{l.quantity}</Text><Pressable accessibilityLabel={"Add "+i.title} onPress={()=>setCart(c=>addItem(c,i.id))} style={[styles.add,{backgroundColor:t.primary}]}><Text style={styles.addText}>+</Text></Pressable></View></View></View>})}
        <Text style={styles.h2}>Subtotal: {money(subtotal(cart))}</Text><Text style={styles.notice}>Checkout unavailable in prototype. Delivery, taxes and payment are not calculated.</Text>
      </>}
    </ScrollView>
    <View style={styles.bottom}><Pressable onPress={()=>setTab("browse")} accessibilityRole="tab" accessibilityState={{selected:tab==="browse"}} style={styles.tab}><Text style={{color:tab==="browse"?t.primary:t.ink,fontWeight:"700"}}>⌂ Explore</Text></Pressable><Pressable onPress={()=>setTab("cart")} accessibilityRole="tab" accessibilityState={{selected:tab==="cart"}} style={styles.tab}><Text style={{color:tab==="cart"?t.primary:t.ink,fontWeight:"700"}}>🛍️ Basket ({count})</Text></Pressable></View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1},header:{paddingHorizontal:20,paddingTop:16,paddingBottom:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},logo:{fontSize:30,fontWeight:"900",letterSpacing:-2},location:{color:"#5e5363"},content:{paddingHorizontal:18,paddingBottom:30},hero:{padding:27,borderRadius:25,marginTop:10,marginBottom:15},eyebrow:{fontSize:11,letterSpacing:1,fontWeight:"800",color:"white"},heroTitle:{fontWeight:"900",fontSize:36,lineHeight:43,color:"white",marginVertical:14},heroCaption:{fontSize:14,color:"white"},notice:{backgroundColor:"#FFF0D2",padding:12,borderRadius:12,fontSize:12,color:"#513900",marginVertical:8},h2:{fontSize:23,fontWeight:"900",color:"#251C29",marginVertical:17},row:{flexGrow:0,marginBottom:8},swatch:{height:36,width:36,borderRadius:18,marginRight:12},chip:{paddingVertical:13,paddingHorizontal:16,borderRadius:14,marginRight:9},search:{backgroundColor:"white",padding:15,borderRadius:14,marginVertical:14,borderWidth:1,borderColor:"#ECE4E5"},item:{flexDirection:"row",padding:15,marginBottom:12,backgroundColor:"white",borderRadius:20,alignItems:"center"},art:{fontSize:47,marginRight:15},merchant:{fontSize:11,color:"#71656C"},itemTitle:{fontSize:16,fontWeight:"800",color:"#251C29",marginTop:4},desc:{fontSize:12,color:"#71656C",marginTop:5},itemBottom:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:11,gap:9},price:{fontWeight:"800",fontSize:15},add:{borderRadius:11,paddingVertical:9,paddingHorizontal:13},addText:{color:"white",fontWeight:"800"},bottom:{backgroundColor:"white",borderTopWidth:1,borderColor:"#F0E6E6",flexDirection:"row",paddingVertical:16},tab:{flex:1,alignItems:"center"}});
