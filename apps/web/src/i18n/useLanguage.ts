import {useEffect,useState} from 'react';
import {languages,type Language} from '@tazumo/core';

export const languageStorageKey='tazumo.language';
const isLanguage=(value:unknown):value is Language=>languages.includes(value as Language);

function readStoredLanguage():Language {
  try{const stored=window.localStorage.getItem(languageStorageKey);return isLanguage(stored)?stored:'en';}
  catch{return 'en';}
}

export function useLanguage(){
  const [lang,setLang]=useState<Language>(readStoredLanguage);
  useEffect(()=>{
    document.documentElement.lang=lang;
    try{window.localStorage.setItem(languageStorageKey,lang);}catch{}
  },[lang]);
  return [lang,setLang] as const;
}
