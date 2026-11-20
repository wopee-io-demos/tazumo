import test from 'node:test';
import assert from 'node:assert/strict';
import {products,cartTotal,changeQuantity} from './index.ts';
import {merchants,findMerchant,findProduct,merchantForProduct,productsForMerchant,filterMerchants,setQuantity,removeFromCart,cartLines} from './discovery.ts';

test('every product belongs to exactly one merchant and every merchant has products',()=>{
  for(const p of products)assert.equal(merchants.filter(m=>m.name===p.merchant).length,1,p.id);
  for(const m of merchants){assert.ok(productsForMerchant(m).length>0,m.id);assert.ok(productsForMerchant(m).every(p=>p.category===m.category),m.id)}
  assert.equal(new Set(merchants.map(m=>m.id)).size,merchants.length);
});
test('merchant search matches merchant fields and their products',()=>{
  assert.deepEqual(filterMerchants('piazza').map(m=>m.id),['piazza-local']);
  assert.deepEqual(filterMerchants('SOURDOUGH').map(m=>m.id),['morning-market']);
  assert.deepEqual(filterMerchants('bouquet').map(m=>m.id),['bloom-and-grow']);
  assert.equal(filterMerchants('').length,merchants.length);
});
test('merchant category filter combines with search and can return nothing',()=>{
  assert.deepEqual(filterMerchants('','Shops').map(m=>m.id),['city-tech','corner-bookshop']);
  assert.deepEqual(filterMerchants('pizza','Groceries'),[]);
  assert.deepEqual(filterMerchants('no such thing'),[]);
});
test('lookups return undefined for unknown ids',()=>{
  assert.equal(findMerchant('piazza-local')?.name,'Piazza Local');
  assert.equal(findMerchant('nope'),undefined);
  assert.equal(findProduct('bread')?.priceCents,450);
  assert.equal(findProduct('nope'),undefined);
  assert.equal(merchantForProduct(findProduct('book')!)?.id,'corner-bookshop');
});
test('cart lines and totals stay in integer minor units',()=>{
  let cart=changeQuantity(changeQuantity({},'pizza',3),'bread',2);
  const lines=cartLines(cart);
  assert.deepEqual(lines.map(l=>[l.product.id,l.quantity,l.lineTotalMinor]),[['pizza',3,3570],['bread',2,900]]);
  assert.equal(cartTotal(cart),4470);
  assert.ok(lines.every(l=>Number.isInteger(l.lineTotalMinor)));
  cart=removeFromCart(cart,'pizza');
  assert.deepEqual(cart,{bread:2});
  assert.equal(cartTotal(cart),900);
  cart=removeFromCart(cart,'bread');
  assert.deepEqual(cart,{});
  assert.deepEqual(cartLines(cart),[]);
  assert.equal(cartTotal(cart),0);
});
test('setQuantity clamps to non-negative whole numbers',()=>{
  assert.deepEqual(setQuantity({},'pizza',2.7),{pizza:2});
  assert.deepEqual(setQuantity({pizza:2},'pizza',-1),{});
  assert.deepEqual(removeFromCart({},'pizza'),{});
});
