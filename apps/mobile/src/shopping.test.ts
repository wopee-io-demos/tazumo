import test from 'node:test';
import assert from 'node:assert/strict';
import {languages} from '@tazumo/core';
import {initialStack,pushRoute,popRoute,cartLines,removeLine,findProduct} from './shopping.ts';
import {m,languagesWithMessages} from './messages.ts';

test('navigates catalogue -> product -> cart and back again',()=>{
 const product=pushRoute(initialStack,{name:'product',productId:'pizza'});
 const cart=pushRoute(product,{name:'cart'});
 assert.deepEqual(cart.map(r=>r.name),['catalogue','product','cart']);
 assert.deepEqual(popRoute(cart),product);
 assert.deepEqual(popRoute(popRoute(cart)),initialStack);
});

test('back on the catalogue and repeated pushes do not grow the stack',()=>{
 assert.equal(popRoute(initialStack),initialStack);
 const cart=pushRoute(initialStack,{name:'cart'});
 assert.equal(pushRoute(cart,{name:'cart'}),cart);
 const pizza=pushRoute(initialStack,{name:'product',productId:'pizza'});
 assert.equal(pushRoute(pizza,{name:'product',productId:'bread'}).length,3);
});

test('cart lines follow catalogue order and removal drops the whole line',()=>{
 const cart={bread:2,pizza:1};
 assert.deepEqual(cartLines(cart).map(l=>[l.product.id,l.quantity]),[['pizza',1],['bread',2]]);
 assert.deepEqual(removeLine(cart,'bread'),{pizza:1});
 assert.deepEqual(removeLine({},'bread'),{});
 assert.equal(findProduct('missing'),undefined);
});

test('every supported language has the mobile shopping copy',()=>{
 assert.deepEqual([...languagesWithMessages].sort(),[...languages].sort());
 for(const lang of languages){assert.ok(m(lang,'prototype'));assert.ok(m(lang,'back'))}
});
