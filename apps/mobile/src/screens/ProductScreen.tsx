import React from 'react';
import {View,Text,Pressable,ScrollView,StyleSheet,AccessibilityInfo,Platform} from 'react-native';
import {t,categoryLabel,formatLocalizedPrice,type Language,type Product} from '@tazumo/core';
import {m} from '../messages';
import {ScreenHeader} from './ScreenHeader';
import type {Colors} from './types';

type Props={product:Product;quantity:number;count:number;lang:Language;colors:Colors;onAdd:()=>void;onBack:()=>void;onCart:()=>void};

export function ProductScreen({product,quantity,count,lang,colors,onAdd,onBack,onCart}:Props){
 const add=()=>{onAdd();if(Platform.OS==='ios')AccessibilityInfo.announceForAccessibility(`${m(lang,'inCart')}: ${quantity+1}`)};
 return <View testID="sut-detail-screen" style={styles.screen}>
  <ScreenHeader title={product.name} lang={lang} colors={colors} count={count} onBack={onBack} onCart={onCart}/>
  <ScrollView contentContainerStyle={styles.body}>
   <View style={[styles.hero,{backgroundColor:colors.background}]}><Text style={styles.emoji} accessible={false}>{product.emoji}</Text></View>
   <Text style={styles.merchant}>{product.merchant} · {categoryLabel(lang,product.category)}</Text>
   <Text testID="sut-detail-title" style={[styles.name,{color:colors.ink}]}>{product.name}</Text>
   <Text style={styles.description}>{product.description}</Text>
   <Text testID="sut-detail-price" style={styles.price}>{formatLocalizedPrice(product.priceCents,lang)}</Text>
   <Text style={styles.note}>{t(lang,'demo')}</Text>
   <Pressable testID="sut-detail-add" accessibilityRole="button" accessibilityLabel={`${m(lang,'addToCart')}: ${product.name}`} onPress={add} style={[styles.add,{backgroundColor:colors.primary}]}><Text style={styles.addText}>{m(lang,'addToCart')}</Text></Pressable>
   <Text testID="sut-detail-quantity" accessibilityLiveRegion="polite" style={styles.inCart}>{m(lang,'inCart')}: {quantity}</Text>
  </ScrollView>
 </View>;
}

const styles=StyleSheet.create({
 screen:{flex:1},
 body:{padding:20,paddingBottom:50},
 hero:{borderRadius:24,alignItems:'center',paddingVertical:36},
 emoji:{fontSize:96},
 merchant:{fontSize:12,color:'#75697C',marginTop:20},
 name:{fontSize:28,fontWeight:'900',marginTop:6},
 description:{fontSize:16,color:'#584D5B',lineHeight:24,marginTop:8},
 price:{fontSize:22,fontWeight:'800',marginTop:14},
 note:{fontSize:12,color:'#746E78',marginTop:7,lineHeight:18},
 add:{minHeight:52,borderRadius:16,alignItems:'center',justifyContent:'center',marginTop:22},
 addText:{color:'white',fontWeight:'800',fontSize:17},
 inCart:{fontSize:15,color:'#584D5B',marginTop:12,textAlign:'center'}
});
