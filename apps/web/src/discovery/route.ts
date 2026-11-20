import {useEffect,useState} from 'react';

export type Route = {name:'home'} | {name:'merchant';id:string} | {name:'product';id:string};

export function parseRoute(hash:string):Route {
  const match=/^#\/(merchant|product)\/([^/?#]+)$/.exec(hash);
  if(!match)return {name:'home'};
  try{return {name:match[1] as 'merchant'|'product',id:decodeURIComponent(match[2])};}
  catch{return {name:'home'};}
}
export const homeHref='#/';
export const merchantHref=(id:string)=>`#/merchant/${encodeURIComponent(id)}`;
export const productHref=(id:string)=>`#/product/${encodeURIComponent(id)}`;

let navigated=false;
export const hasNavigated=()=>navigated;

export function useHashRoute():Route {
  const [route,setRoute]=useState(()=>parseRoute(window.location.hash));
  useEffect(()=>{
    const onChange=()=>{navigated=true;const next=parseRoute(window.location.hash);setRoute(next);if(next.name!=='home')window.scrollTo(0,0);};
    window.addEventListener('hashchange',onChange);
    return ()=>window.removeEventListener('hashchange',onChange);
  },[]);
  return route;
}
