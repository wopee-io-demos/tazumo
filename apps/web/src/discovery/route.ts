import {useEffect,useState} from 'react';

export type Route = {name:'home'} | {name:'merchant';id:string} | {name:'product';id:string};

export function parseRoute(hash:string):Route {
  const match=/^#\/(merchant|product)\/([^/?#]+)$/.exec(hash);
  if(!match)return {name:'home'};
  return {name:match[1] as 'merchant'|'product',id:decodeURIComponent(match[2])};
}
export const homeHref='#/';
export const merchantHref=(id:string)=>`#/merchant/${encodeURIComponent(id)}`;
export const productHref=(id:string)=>`#/product/${encodeURIComponent(id)}`;

export function useHashRoute():Route {
  const [route,setRoute]=useState(()=>parseRoute(window.location.hash));
  useEffect(()=>{
    const onChange=()=>{setRoute(parseRoute(window.location.hash));window.scrollTo(0,0);};
    window.addEventListener('hashchange',onChange);
    return ()=>window.removeEventListener('hashchange',onChange);
  },[]);
  return route;
}
