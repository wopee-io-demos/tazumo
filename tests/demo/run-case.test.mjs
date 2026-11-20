import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {find,center,visible} from './run-case.mjs';

const rect=(x,y,width=40,height=40)=>({x,y,width,height});
const screen={width:400,height:800};

test('find matches a label, text or identifier and collapses duplicates with the same frame',()=>{
 const tree={elements:[
  {label:'Cart, 1',rect:rect(300,20)},
  {text:'Subtotal €11.90',rect:rect(20,600,200,20),children:[{text:'Subtotal €11.90',rect:rect(20,600,200,20)}]},
  {identifier:'sut-search',rect:rect(20,300,300,40)}
 ]};
 assert.equal(find(tree,'accessibility id','Cart, 1',screen).length,1);
 assert.equal(find(tree,'text','Subtotal €11.90',screen).length,1);
 assert.equal(find(tree,'id','sut-search',screen).length,1);
 assert.equal(find(tree,'accessibility id','Cart, 0',screen).length,0);
});

test('find ignores zero-sized and off-screen elements and keeps distinct frames ambiguous',()=>{
 const tree={elements:[
  {label:'Add Margherita pizza',rect:rect(20,900)},
  {label:'Add Margherita pizza',rect:rect(20,20,0,0)},
  {label:'Remove one Margherita pizza',rect:rect(20,100)},
  {label:'Remove one Margherita pizza',rect:rect(20,200)}
 ]};
 assert.equal(find(tree,'accessibility id','Add Margherita pizza',screen).length,0);
 assert.equal(find(tree,'accessibility id','Remove one Margherita pizza',screen).length,2);
 assert.equal(visible({rect:rect(0,0)}),true);
});

test('center returns integer tap coordinates',()=>{
 assert.equal(center({rect:{x:331,y:628,width:38,height:38}}),'350,647');
});

test('the demo case targets the same flow on iOS and Android and ends on the cart',()=>{
 const c=JSON.parse(readFileSync(new URL('./flow-search-add-cart.json',import.meta.url),'utf8'));
 const flow=p=>c.platforms[p].steps.filter(s=>s.value!=='Return');
 assert.deepEqual(flow('ios'),flow('android'));
 for(const p of ['ios','android']){
  const steps=c.platforms[p].steps;
  assert.equal(c.platforms[p].app,'io.wopee.demos.tazumo');
  assert.ok(steps.some(s=>s.action==='type'&&s.text==='Margherita'));
  assert.deepEqual(steps.at(-1),{action:'see',by:'accessibility id',value:'Remove one Margherita pizza'});
 }
});
