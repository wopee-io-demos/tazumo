import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {languages,changeQuantity,cartTotal} from '@tazumo/core';
import {initialStack,pushRoute,popRoute,cartLines,removeLine,findProduct} from './shopping.ts';
import {m,languagesWithMessages,type MobileMessageKey} from './messages.ts';

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
 const decreased=changeQuantity({pizza:1},'pizza',-1);
 assert.deepEqual(cartLines(decreased),[]);
 assert.equal(cartTotal(decreased),0);
 assert.equal(findProduct('missing'),undefined);
});

test('every supported language has the mobile shopping copy',()=>{
 assert.deepEqual([...languagesWithMessages].sort(),[...languages].sort());
 const keys=['back','viewCart','openDetails','addToCart','inCart','remove','quantity','prototype'] satisfies MobileMessageKey[];
 for(const lang of languages)for(const key of keys)assert.ok(m(lang,key).trim(),`${lang}.${key}`);
});

test('every documented native testID is rendered by the app source',()=>{
 const file=(rel:string)=>fileURLToPath(new URL(rel,import.meta.url).href);
 const rows=readFileSync(file('../../../openspec/changes/native-shopping/design.md'),'utf8').split('\n').filter(l=>l.startsWith('| `sut-'));
 const ids=rows.flatMap(r=>[...r.matchAll(/`(sut-[a-z-]+?)(-<id>)?`/g)].map(x=>x[1]+(x[2]?'-':'')));
 assert.equal(ids.length,19);
 const source=['./App.tsx',...readdirSync(file('./screens')).map(f=>'./screens/'+f)].map(f=>readFileSync(file(f),'utf8')).join('\n');
 for(const id of ids)assert.ok(source.includes(id),`missing testID ${id}`);
});
