/** Device-local favourite merchants, keyed by the merchant's stable string id. */
export function parseFavourites(raw:string|null|undefined,knownIds?:readonly string[]):string[] {
  if(!raw)return [];
  let value:unknown;
  try{value=JSON.parse(raw);}catch{return [];}
  if(!Array.isArray(value))return [];
  const ids=value.filter((x):x is string=>typeof x==='string'&&x.length>0&&(!knownIds||knownIds.includes(x)));
  return [...new Set(ids)];
}
export const toggleFavourite=(list:readonly string[],id:string):string[]=>list.includes(id)?list.filter(x=>x!==id):[...list,id];
export const serializeFavourites=(list:readonly string[]):string=>JSON.stringify(list);
