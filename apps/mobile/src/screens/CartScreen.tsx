import React from 'react';
import {View,Text,Pressable,ScrollView,StyleSheet,AccessibilityInfo} from 'react-native';
import {t,cartTotal,formatLocalizedPrice,type Cart,type Language} from '@tazumo/core';
import {m} from '../messages';
import {cartLines} from '../shopping';
import {ScreenHeader} from './ScreenHeader';
import type {Colors} from './types';

type Props={cart:Cart;count:number;lang:Language;colors:Colors;onChange:(id:string,delta:number)=>void;onRemove:(id:string)=>void;onBack:()=>void};

export function CartScreen({cart,count,lang,colors,onChange,onRemove,onBack}:Props){
 const lines=cartLines(cart);
 const change=(id:string,name:string,next:number,delta:number)=>{onChange(id,delta);AccessibilityInfo.announceForAccessibility(next>0?`${name}, ${m(lang,'quantity')}: ${next}`:`${m(lang,'remove')} ${name}`)};
 const remove=(id:string,name:string)=>{onRemove(id);AccessibilityInfo.announceForAccessibility(`${m(lang,'remove')} ${name}`)};
 return <View testID="sut-cart-screen" style={styles.screen}>
  <ScreenHeader title={t(lang,'basket')} lang={lang} colors={colors} count={count} onBack={onBack}/>
  <ScrollView contentContainerStyle={styles.body}>
   {lines.length===0?<Text testID="sut-cart-empty" style={styles.empty}>{t(lang,'emptyBasket')}</Text>:null}
   {lines.map(({product:p,quantity})=><View key={p.id} testID={`sut-cart-line-${p.id}`} style={styles.line}>
    <Text style={styles.emoji} accessible={false}>{p.emoji}</Text>
    <View style={styles.info}>
     <Text style={styles.name}>{p.name}</Text>
     <Text style={styles.price}>{formatLocalizedPrice(p.priceCents*quantity,lang)}</Text>
     <Pressable testID={`sut-cart-remove-${p.id}`} accessibilityRole="button" accessibilityLabel={`${m(lang,'remove')} ${p.name}`} onPress={()=>remove(p.id,p.name)} style={styles.remove}><Text style={[styles.removeText,{color:colors.primary}]}>{m(lang,'remove')}</Text></Pressable>
    </View>
    <View style={styles.stepper}>
     <Pressable testID={`sut-cart-decrease-${p.id}`} accessibilityRole="button" accessibilityLabel={`${t(lang,'removeOne')} ${p.name}`} onPress={()=>change(p.id,p.name,quantity-1,-1)} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
     <Text testID={`sut-cart-quantity-${p.id}`} accessibilityLabel={`${m(lang,'quantity')}: ${quantity}`} style={styles.quantity}>{quantity}</Text>
     <Pressable testID={`sut-cart-increase-${p.id}`} accessibilityRole="button" accessibilityLabel={`${t(lang,'addOne')} ${p.name}`} onPress={()=>change(p.id,p.name,quantity+1,1)} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable>
    </View>
   </View>)}
   <Text testID="sut-cart-subtotal" style={styles.total}>{t(lang,'subtotal')} {formatLocalizedPrice(cartTotal(cart),lang)}</Text>
   <Text testID="sut-cart-prototype-note" style={styles.note}>{m(lang,'prototype')}</Text>
   <Pressable testID="sut-cart-checkout-disabled" accessibilityRole="button" accessibilityState={{disabled:true}} accessibilityLabel={t(lang,'checkoutLater')} accessibilityHint={m(lang,'prototype')} disabled={true} style={styles.checkout}><Text style={styles.checkoutText}>{t(lang,'checkoutLater')}</Text></Pressable>
  </ScrollView>
 </View>;
}

const styles=StyleSheet.create({
 screen:{flex:1},
 body:{padding:18,paddingBottom:50},
 empty:{fontSize:16,color:'#584D5B',marginVertical:24,textAlign:'center'},
 line:{flexDirection:'row',alignItems:'center',gap:12,padding:12,borderRadius:16,borderWidth:1,borderColor:'#EFEAF1',marginBottom:12},
 emoji:{fontSize:36},
 info:{flex:1},
 name:{fontWeight:'800',fontSize:16},
 price:{fontWeight:'700',fontSize:15,marginTop:4},
 remove:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},
 removeText:{fontWeight:'700',textDecorationLine:'underline'},
 stepper:{flexDirection:'row',alignItems:'center',gap:6},
 step:{width:44,height:44,borderRadius:12,backgroundColor:'#F3F1F4',alignItems:'center',justifyContent:'center'},
 stepText:{fontSize:22,fontWeight:'800'},
 quantity:{minWidth:24,textAlign:'center',fontSize:17,fontWeight:'800'},
 total:{fontWeight:'800',fontSize:19,marginTop:8},
 note:{fontSize:13,color:'#584D5B',marginTop:8,lineHeight:19},
 checkout:{minHeight:52,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:16,backgroundColor:'#E8E5E9'},
 checkoutText:{color:'#514A56',fontWeight:'800'}
});
