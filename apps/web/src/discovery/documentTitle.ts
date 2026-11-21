import {useLayoutEffect} from 'react';
import {brandName} from '@tazumo/brand';
import {findMerchant,findProduct,t,type Language} from '@tazumo/core';
import type {Route} from './route';

export function pageTitle(route:Route,lang:Language):string {
  const page=route.name==='home'?t(lang,'explore')
    :route.name==='merchant'?findMerchant(route.id)?.name??t(lang,'notFound')
    :findProduct(route.id)?.name??t(lang,'notFound');
  return `${page} · ${brandName} (${t(lang,'demoLabel')})`;
}

export function useDocumentTitle(route:Route,lang:Language){
  const title=pageTitle(route,lang);
  useLayoutEffect(()=>{document.title=title;},[title]);
}
