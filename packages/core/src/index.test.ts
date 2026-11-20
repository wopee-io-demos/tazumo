import test from 'node:test';
import assert from 'node:assert/strict';
import {products,filterProducts,changeQuantity,cartCount,cartTotal} from './index.ts';
test('filters the catalogue by category and merchant',()=>{assert.ok(filterProducts(products,'Piazza','Food').some(x=>x.id==='pizza'));assert.equal(filterProducts(products,'bread','Food').length,0)});
test('cart quantities never become negative',()=>{const c=changeQuantity({},'pizza',1);assert.equal(cartCount(c),1);assert.equal(cartTotal(c),1190);assert.deepEqual(changeQuantity(c,'pizza',-99),{})});
