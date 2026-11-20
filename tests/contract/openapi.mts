import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Ajv2020} from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';

const addFormats=ajvFormats.default;
import type {Product as FixtureProduct} from '../../packages/core/src/index.ts';

export const specId='https://tazumo.example.invalid/contracts/openapi.json';
export const spec=JSON.parse(readFileSync(new URL('../../contracts/openapi.json',import.meta.url),'utf8'));

const withoutExtensions=(value:unknown):unknown=>Array.isArray(value)?value.map(withoutExtensions)
  :value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!k.startsWith('x-')).map(([k,v])=>[k,withoutExtensions(v)]))
  :value;

export function createValidator(){
  const ajv=new Ajv2020({allErrors:true,strict:true,validateFormats:true});
  addFormats(ajv);
  for(const keyword of ['paths','components','example','discriminator','xml','externalDocs'])ajv.addKeyword(keyword);
  ajv.addSchema({$id:specId,...(withoutExtensions({paths:spec.paths,components:spec.components}) as object)});
  return {
    schema:(name:string)=>ajv.compile({$ref:`${specId}#/components/schemas/${name}`}),
    pointer:(pointer:string)=>ajv.compile({$ref:`${specId}#${pointer}`})
  };
}

const namespace='6f1c2b9e-4d1a-5c3e-9b7a-2d8e0f4a6c11';
export function fixtureUuid(kind:string,key:string):string{
  const bytes=createHash('sha1').update(Buffer.from(namespace.replace(/-/g,''),'hex')).update(`${kind}:${key}`).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x50;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export const demoMarketCode='demo-eu';

export function toApiProduct(p:FixtureProduct,currency='EUR'){
  return {
    id:fixtureUuid('product',p.id),
    merchantId:fixtureUuid('merchant',p.merchant),
    name:p.name,
    description:p.description,
    price:{currency,minorUnits:p.priceCents},
    available:true
  };
}

export function toApiMerchants(list:FixtureProduct[]){
  const byName=new Map<string,Set<string>>();
  for(const p of list){
    if(!byName.has(p.merchant))byName.set(p.merchant,new Set());
    byName.get(p.merchant)!.add(p.category);
  }
  return [...byName].map(([name,cats])=>({
    id:fixtureUuid('merchant',name),
    marketCode:demoMarketCode,
    name,
    categories:[...cats],
    acceptingOrders:false,
    deliveryEtaMinutes:null
  }));
}
