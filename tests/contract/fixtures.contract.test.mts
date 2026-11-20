import {test} from 'node:test';
import assert from 'node:assert/strict';
import {products,categories} from '../../packages/core/src/index.ts';
import {createValidator,toApiProduct,toApiMerchants,fixtureUuid} from './openapi.mts';

const v=createValidator();
const validateProduct=v.schema('Product');
const validateMerchant=v.schema('Merchant');
const validateProductsResponse=v.pointer('/paths/~1v1~1merchants~1%7BmerchantId%7D~1products/get/responses/200/content/application~1json/schema');
const validateMerchantsResponse=v.pointer('/paths/~1v1~1merchants/get/responses/200/content/application~1json/schema');
const errors=(fn:{errors?:unknown})=>JSON.stringify(fn.errors,null,1);

test('every synthetic product validates against the OpenAPI Product schema',()=>{
  assert.ok(products.length>0);
  for(const p of products){
    const api=toApiProduct(p);
    assert.ok(validateProduct(api),`${p.id}: ${errors(validateProduct)}`);
  }
});

test('each merchant catalogue validates as its GET /v1/merchants/{merchantId}/products response',()=>{
  const merchantIds=new Set(toApiMerchants(products).map(m=>m.id));
  for(const merchant of new Set(products.map(p=>p.merchant))){
    const body=products.filter(p=>p.merchant===merchant).map(p=>toApiProduct(p));
    assert.ok(validateProductsResponse(body),`${merchant}: ${errors(validateProductsResponse)}`);
    for(const product of body)assert.ok(merchantIds.has(product.merchantId),`${product.name} links to an unknown merchant`);
  }
});

test('merchants derived from the fixtures validate and never claim live ordering or ETAs',()=>{
  const merchants=toApiMerchants(products);
  assert.equal(merchants.length,new Set(products.map(p=>p.merchant)).size);
  assert.ok(validateMerchantsResponse(merchants),errors(validateMerchantsResponse));
  for(const m of merchants){
    assert.ok(validateMerchant(m),`${m.name}: ${errors(validateMerchant)}`);
    assert.equal(m.acceptingOrders,false);
    assert.equal(m.deliveryEtaMinutes,null);
  }
});

test('fixture identifiers are unique and project to stable unique UUIDs',()=>{
  const ids=products.map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length);
  const uuids=products.map(p=>toApiProduct(p).id);
  assert.equal(new Set(uuids).size,uuids.length);
  assert.equal(fixtureUuid('product','pizza'),fixtureUuid('product','pizza'));
  assert.notEqual(fixtureUuid('product','pizza'),fixtureUuid('merchant','pizza'));
});

test('fixture prices are whole minor units and categories are declared',()=>{
  for(const p of products){
    assert.ok(Number.isInteger(p.priceCents)&&p.priceCents>=0,`${p.id} price ${p.priceCents}`);
    assert.ok(categories.includes(p.category),`${p.id} category ${p.category}`);
  }
});

const valid=toApiProduct(products[0]);
const malformed:[string,unknown,string][]=[
  ['negative price',{...valid,price:{...valid.price,minorUnits:-1}},'minimum'],
  ['fractional minor units',{...valid,price:{...valid.price,minorUnits:11.9}},'type'],
  ['lower-case currency',{...valid,price:{...valid.price,currency:'eur'}},'pattern'],
  ['unknown Money property',{...valid,price:{...valid.price,amount:'11.90'}},'additionalProperties'],
  ['missing name',(({name,...rest})=>rest)(valid),'required'],
  ['missing availability',(({available,...rest})=>rest)(valid),'required'],
  ['fixture key instead of UUID',{...valid,id:'pizza'},'format'],
  ['string availability',{...valid,available:'yes'},'type']
];
for(const [label,body,keyword] of malformed){
  test(`a malformed product fails validation: ${label}`,()=>{
    assert.equal(validateProduct(body),false);
    assert.ok(validateProduct.errors?.some(e=>e.keyword===keyword),`expected ${keyword}, got ${errors(validateProduct)}`);
  });
}

test('the projection does not hide a malformed core fixture',()=>{
  const broken={...products[0],priceCents:-50};
  assert.equal(validateProduct(toApiProduct(broken)),false);
  assert.equal(validateProductsResponse([...products.map(p=>toApiProduct(p)),toApiProduct(broken)]),false);
});
