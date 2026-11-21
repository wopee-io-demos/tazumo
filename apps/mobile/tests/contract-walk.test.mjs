import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PLAN,expectedIds,loadCore,placeholderValues,verifyWalk,walk} from './contract-walk.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const contract=JSON.parse(readFileSync(join(here,'../../../contracts/sut.json'),'utf8'));
const core=await loadCore();
const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
const temps=[];
const tmp=()=>{const d=mkdtempSync(join(tmpdir(),'tazumo-walk-'));temps.push(d);return d};
test.after(()=>{for(const d of temps)rmSync(d,{recursive:true,force:true})});
const clone=x=>JSON.parse(JSON.stringify(x));

// In-memory Appium over a model of the Tazumo app screens. Off-screen IDs appear only after a UiScrollable lookup
// of the right orientation (category pills scroll horizontally, everything else vertically).
function fakeApp({missing=[],enabledCheckout=false,ready=true}={}){
 const s={screen:'catalogue',basket:false,qty:0,revealed:new Set()},log=[];
 const offscreen=['sut-category-shops','sut-category-gifts','sut-product-bread','sut-add-bread','sut-open-product-bread','sut-language-en','sut-language-cs','sut-language-de'];
 const ids=()=>{
  let v;
  if(s.screen==='catalogue'){
   v=['sut-search','sut-cart-open','sut-product-pizza','sut-add-pizza','sut-open-product-pizza','sut-category-all','sut-category-food','sut-category-groceries',...offscreen.filter(x=>s.revealed.has(x))];
   if(s.basket)v.push('sut-cart-summary','sut-checkout-disabled','sut-cart-screen-open');
  }else if(s.screen==='detail')v=['sut-detail-screen','sut-detail-title','sut-detail-price','sut-detail-add','sut-detail-quantity','sut-nav-back','sut-nav-cart'];
  else{
   v=['sut-cart-screen','sut-cart-subtotal','sut-cart-prototype-note','sut-cart-checkout-disabled','sut-nav-back'];
   v.push(...(s.qty>0?['sut-cart-line-pizza','sut-cart-increase-pizza','sut-cart-decrease-pizza','sut-cart-remove-pizza','sut-cart-quantity-pizza']:['sut-cart-empty']));
  }
  return v.filter(x=>!missing.includes(x));
 };
 const tap=id=>{
  if(id==='sut-add-pizza'||id==='sut-detail-add'||id==='sut-cart-increase-pizza')s.qty++;
  else if(id==='sut-cart-decrease-pizza')s.qty=Math.max(0,s.qty-1);
  else if(id==='sut-cart-remove-pizza')s.qty=0;
  else if(id==='sut-cart-open')s.basket=!s.basket;
  else if(id==='sut-open-product-pizza')s.screen='detail';
  else if(id==='sut-nav-cart'){s.screen='cart';s.revealed.clear()}
 };
 const call=async(method,path,body)=>{
  log.push(`${method} ${path}`);
  if(path==='/status')return {ready};
  if(method==='POST'&&path==='/session')return {sessionId:'s1'};
  if(path.endsWith('/elements')){
   if(body.using==='id')return ids().filter(x=>x===body.value).map(x=>({[ELEMENT]:`${x}#0`}));
   const target=/resourceId\("([^"]+)"\)/.exec(body.value)[1],horizontal=body.value.includes('setAsHorizontalList');
   if(s.screen==='catalogue'&&offscreen.includes(target)&&!missing.includes(target)&&horizontal===target.startsWith('sut-category-'))s.revealed.add(target);
   return ids().includes(target)?[{[ELEMENT]:`${target}#0`}]:[];
  }
  const id=decodeURIComponent(path.split('/element/')[1]??'').split('#')[0];
  if(path.endsWith('/displayed'))return ids().includes(id);
  if(path.endsWith('/click')){tap(id);return null}
  if(path.endsWith('/enabled'))return id.includes('checkout-disabled')?enabledCheckout:true;
  if(path.endsWith('/text'))return id==='sut-detail-quantity'?`In your cart: ${s.qty}`:id==='sut-cart-quantity-pizza'?String(s.qty):'';
  if(path.endsWith('/source'))return `<hierarchy>${ids().map(x=>`<node resource-id="${x}"/>`).join('')}</hierarchy>`;
  if(path.endsWith('/screenshot'))return Buffer.from('png').toString('base64');
  return null;
 };
 return {call,log};
}
const run=async(opts,c=contract)=>{const out=tmp(),{call,log}=fakeApp(opts);const report=await walk(c,core,call,out,{timeout:30});return {out,log,report,verdict:verifyWalk(c,core,report,out)}};

test('the walk plan gives every native contract ID of v0.2.0 a screen',()=>{
 const values=placeholderValues(contract,core),ids=expectedIds(contract,values);
 for(const key of Object.keys(contract.native.selectors))assert.ok(ids.some(e=>e.keys.includes(`selectors.${key}`)),key);
 for(const key of Object.keys(contract.native.selectorTemplates))assert.ok(ids.some(e=>e.keys.includes(`selectorTemplates.${key}`)),key);
 assert.equal(new Set(ids.map(e=>e.id)).size,ids.length);
 assert.ok(ids.some(e=>e.id==='sut-category-gifts')&&ids.some(e=>e.id==='sut-language-de')&&ids.some(e=>e.id==='sut-product-bread'));
});

test('a contract ID without a screen in the plan fails before anything runs',async()=>{
 const c=clone(contract);
 c.native.selectors.newThing='sut-new-thing';
 assert.throws(()=>expectedIds(c,placeholderValues(c,core)),/native\.selectors\.newThing has no screen/);
 const {report,verdict}=await run({},c);
 assert.equal(report.outcome,'infrastructure-failed');
 assert.equal(verdict.ok,false);
});

test('a full walk resolves every ID by id, scrolls only for off-screen ones and saves the trees',async()=>{
 const {out,log,report,verdict}=await run({});
 assert.equal(report.outcome,'passed',report.error);
 assert.ok(verdict.ok,verdict.reason);
 assert.equal(report.ids.length,report.expected);
 assert.deepEqual(report.states.map(s=>s.name),PLAN.map(s=>s.name));
 assert.deepEqual(report.ids.filter(e=>e.scrolled).map(e=>e.id).sort(),['sut-add-bread','sut-category-gifts','sut-category-shops','sut-language-cs','sut-language-de','sut-language-en','sut-open-product-bread','sut-product-bread']);
 assert.ok(log.indexOf('POST /session/s1/appium/settings')<log.findIndex(l=>l.endsWith('/elements')));
 assert.ok(log.includes('DELETE /session/s1'));
 for(const e of report.ids)assert.match(readFileSync(join(out,e.file),'utf8'),new RegExp(`resource-id="${e.id}"`));
 assert.ok(readdirSync(out).filter(f=>f.endsWith('.xml')).length>=PLAN.length);
 assert.deepEqual(report.checks.filter(c=>c.check==='disabled').map(c=>[c.id,c.actual]),[['sut-checkout-disabled',false],['sut-cart-checkout-disabled',false],['sut-cart-checkout-disabled',false]]);
 assert.deepEqual(report.checks.filter(c=>c.check==='text').map(c=>c.actual),['In your cart: 1','2','3','2']);
});

test('a contract ID missing from the app fails the walk and the verifier',async()=>{
 for(const id of ['sut-nav-back','sut-cart-prototype-note','sut-language-cs','sut-cart-empty']){
  const {report,verdict}=await run({missing:[id]});
  assert.equal(report.outcome,'failed',id);
  assert.match(report.error,new RegExp(id));
  assert.equal(verdict.ok,false);
 }
});

test('an enabled checkout control fails',async()=>{
 const {report,verdict}=await run({enabledCheckout:true});
 assert.equal(report.outcome,'failed');
 assert.match(report.error,/disabled sut-checkout-disabled/);
 assert.equal(verdict.ok,false);
});

test('Appium not ready is an infrastructure failure, never a pass',async()=>{
 const {report,verdict}=await run({ready:false});
 assert.equal(report.outcome,'infrastructure-failed');
 assert.equal(report.assertions,0);
 assert.equal(verdict.ok,false);
});

test('the verifier fails closed on a missing, foreign, empty or tampered report',async()=>{
 const {out,report}=await run({});
 assert.ok(verifyWalk(contract,core,report,out).ok);
 assert.equal(verifyWalk(contract,core,undefined,out).ok,false);
 assert.match(verifyWalk(contract,core,{...report,contractVersion:'0.1.0'},out).reason,/expected 0\.2\.0/);
 assert.match(verifyWalk(contract,core,{...report,settings:{}},out).reason,/disableIdLocatorAutocompletion/);
 assert.match(verifyWalk(contract,core,{...report,assertions:0},out).reason,/zero assertions/);
 assert.match(verifyWalk(contract,core,{...report,ids:report.ids.slice(1)},out).reason,/not resolved/);
 assert.match(verifyWalk(contract,core,{...report,checks:report.checks.filter(c=>c.id!=='sut-cart-checkout-disabled')},out).reason,/not proven disabled/);
 const victim=report.ids.find(e=>e.id==='sut-nav-cart');
 writeFileSync(join(out,victim.file),readFileSync(join(out,victim.file),'utf8').replace('resource-id="sut-nav-cart"',''));
 assert.match(verifyWalk(contract,core,report,out).reason,/sut-nav-cart absent from/);
 assert.ok(existsSync(join(out,'report.json')));
});

const serve=app=>new Promise(resolve=>{
 const server=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  try{const value=await app.call(req.method,req.url,body?JSON.parse(body):undefined);res.end(JSON.stringify({value}))}
  catch(e){res.statusCode=500;res.end(JSON.stringify({value:{error:e.message}}))}
 });
 server.listen(0,'127.0.0.1',()=>resolve(server));
});
const cli=(script,args,env={})=>new Promise(resolve=>{
 const child=spawn(process.execPath,['--experimental-strip-types',join(here,script),...args],{env:{...process.env,...env}});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 child.on('close',code=>resolve({code,output}));
});
const contractPath=join(here,'../../../contracts/sut.json');

test('the walker and verifier CLIs exit 0 only for a complete walk',async()=>{
 for(const [opts,code] of [[{},0],[{missing:['sut-detail-price']},1]]){
  const server=await serve(fakeApp(opts)),out=tmp();
  const env={APPIUM_URL:`http://127.0.0.1:${server.address().port}`,STEP_TIMEOUT_MS:'30',FIRST_STEP_TIMEOUT_MS:'30'};
  const walked=await cli('contract-walk.mjs',[contractPath,out],env);
  server.close();
  assert.equal(walked.code,code,walked.output);
  assert.equal((await cli('verify-contract-walk.mjs',[contractPath,out])).code,code);
 }
 const empty=await cli('verify-contract-walk.mjs',[contractPath,tmp()]);
 assert.equal(empty.code,1);
 assert.match(empty.output,/report\.json missing/);
});
