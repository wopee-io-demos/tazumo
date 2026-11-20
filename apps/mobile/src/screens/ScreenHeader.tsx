import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import type {Language} from '@tazumo/core';
import {m} from '../messages';
import type {Colors} from './types';

type Props={title:string;lang:Language;colors:Colors;count:number;onBack:()=>void;onCart?:()=>void};

export function ScreenHeader({title,lang,colors,count,onBack,onCart}:Props){
 return <View style={styles.bar}>
  <Pressable testID="sut-nav-back" accessibilityRole="button" accessibilityLabel={m(lang,'back')} onPress={onBack} hitSlop={8} style={styles.back}><Text style={[styles.backText,{color:colors.primary}]}>‹ {m(lang,'back')}</Text></Pressable>
  <Text accessibilityRole="header" numberOfLines={1} style={[styles.title,{color:colors.ink}]}>{title}</Text>
  {onCart?<Pressable testID="sut-nav-cart" accessibilityRole="button" accessibilityLabel={`${m(lang,'viewCart')}, ${count}`} onPress={onCart} style={[styles.cart,{backgroundColor:colors.primary}]}><Text style={styles.cartText}>🛍️ {count}</Text></Pressable>:<View style={styles.spacer}/>}
 </View>;
}

const styles=StyleSheet.create({
 bar:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:10,gap:10,borderBottomWidth:1,borderBottomColor:'#EFEAF1'},
 back:{minHeight:44,minWidth:44,justifyContent:'center'},
 backText:{fontSize:17,fontWeight:'700'},
 title:{flex:1,fontSize:18,fontWeight:'800',textAlign:'center'},
 cart:{minHeight:44,minWidth:56,paddingHorizontal:12,borderRadius:22,alignItems:'center',justifyContent:'center'},
 cartText:{color:'white',fontWeight:'800'},
 spacer:{minWidth:56}
});
