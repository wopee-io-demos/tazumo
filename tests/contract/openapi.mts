import {readFileSync} from 'node:fs';
import {Ajv2020} from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';

const addFormats=ajvFormats.default;
import {buildSeed} from '../../apps/api/src/fixtures.ts';

export {buildSeed};

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

export type SeedProduct=ReturnType<typeof buildSeed>['products'][number];

export function toApiProduct(row:SeedProduct){
  return {
    id:row.id,
    slug:row.slug,
    merchantId:row.merchantId,
    category:row.categoryCode,
    name:row.name,
    description:row.description,
    price:{currency:row.currency,minorUnits:row.priceMinor},
    available:true,
    synthetic:true
  };
}

export function toApiMerchants(seed:ReturnType<typeof buildSeed>){
  return seed.merchants.map(m=>({
    id:m.id,
    slug:m.slug,
    marketCode:m.marketCode,
    name:m.name,
    categories:[...new Set(seed.products.filter(p=>p.merchantId===m.id).map(p=>p.categoryCode))].sort(),
    acceptingOrders:false,
    deliveryEtaMinutes:null,
    synthetic:true
  }));
}
