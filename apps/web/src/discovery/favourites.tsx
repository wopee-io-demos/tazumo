import {useCallback,useEffect,useState} from 'react';
import {merchants,parseFavourites,serializeFavourites,t,toggleFavourite,type Language,type Merchant} from '@tazumo/core';

export const favouritesStorageKey='tazumo.favourites';
const knownIds=merchants.map(m=>m.id);

function readFavourites():string[] {
  try{return parseFavourites(window.localStorage.getItem(favouritesStorageKey),knownIds);}catch{return [];}
}

export function useFavourites(){
  const [favourites,setFavourites]=useState<string[]>(readFavourites);
  useEffect(()=>{
    const onStorage=(e:StorageEvent)=>{if(e.key===favouritesStorageKey||e.key===null)setFavourites(parseFavourites(e.newValue,knownIds));};
    window.addEventListener('storage',onStorage);
    return ()=>window.removeEventListener('storage',onStorage);
  },[]);
  useEffect(()=>{try{window.localStorage.setItem(favouritesStorageKey,serializeFavourites(favourites));}catch{}},[favourites]);
  const toggle=useCallback((id:string)=>setFavourites(list=>toggleFavourite(list,id)),[]);
  return {favourites,toggle};
}

export function FavouriteButton({lang,merchant,on,onToggle}:{lang:Language;merchant:Merchant;on:boolean;onToggle:(id:string)=>void}){
  return <button type="button" className="favouriteButton" data-testid={`sut-favourite-${merchant.id}`} aria-pressed={on}
    aria-label={t(lang,on?'favouriteRemove':'favouriteAdd').replace('{name}',merchant.name)} onClick={()=>onToggle(merchant.id)}>
    <span aria-hidden="true">{on?'♥':'♡'}</span>
  </button>;
}
