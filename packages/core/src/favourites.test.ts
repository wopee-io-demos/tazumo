import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFavourites,toggleFavourite,serializeFavourites} from './favourites.ts';
import {merchants} from './discovery.ts';

const known=merchants.map(m=>m.id);
test('non-numeric merchant ids can be favourited and round-trip',()=>{
  const list=toggleFavourite([],'piazza-local');
  assert.deepEqual(list,['piazza-local']);
  assert.deepEqual(parseFavourites(serializeFavourites(list),known),['piazza-local']);
});
test('toggle adds and removes without duplicates',()=>{
  assert.deepEqual(toggleFavourite(toggleFavourite(['green-table'],'piazza-local'),'green-table'),['piazza-local']);
});
test('corrupted or foreign storage content yields an empty list',()=>{
  for(const raw of [null,undefined,'','not json','{"a":1}','42','"piazza-local"','null'])assert.deepEqual(parseFavourites(raw,known),[],String(raw));
  assert.deepEqual(parseFavourites('[1,null,{},"",true]',known),[]);
});
test('unknown merchant ids and duplicates are dropped',()=>{
  assert.deepEqual(parseFavourites('["gone-merchant","city-tech","city-tech"]',known),['city-tech']);
  assert.deepEqual(parseFavourites('["anything"]'),['anything']);
});
