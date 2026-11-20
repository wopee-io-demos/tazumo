import {useLayoutEffect,useState} from 'react';
import {languages,type Language} from '@tazumo/core';

export const languageStorageKey='tazumo.language';
const isLanguage=(value:unknown):value is Language=>languages.includes(value as Language);

function initialLanguage():Language {
  const requested=new URLSearchParams(window.location.search).get('lang');
  if(isLanguage(requested))return requested;
  try{const stored=window.localStorage.getItem(languageStorageKey);return isLanguage(stored)?stored:'en';}
  catch{return 'en';}
}

export function useLanguage(){
  const [lang,setLang]=useState<Language>(initialLanguage);
  useLayoutEffect(()=>{
    document.documentElement.lang=lang;
    try{window.localStorage.setItem(languageStorageKey,lang);}catch{}
  },[lang]);
  return [lang,setLang] as const;
}
