import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PLAN,expectedIds,loadCore,nodeAttributes,placeholderValues,requiredChecks,verifyWalk,walk} from './contract-walk.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const contract=JSON.parse(readFileSync(join(here,'../../../contracts/sut.json'),'utf8'));
const core=await loadCore();
const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
const temps=[];
const tmp=()=>{const d=mkdtempSync(join(tmpdir(),'tazumo-walk-'));temps.push(d);return d};
test.after(()=>{for(const d of temps)rmSync(d,{recursive:true,force:true})});
const clone=x=>JSON.parse(JSON.stringify(x));

// In-memory Appium over a model of the Tazumo app. The catalogue is a vertical ScrollView with a viewport: IDs at the
// bottom (mini-cart buttons, bread, languages) are hidden until a vertical UiScrollable reaches them, and that scroll
// hides the top (header, category pills, pizza). The pills are a HorizontalScrollView: shops and gifts need a
// horizontal UiScrollable, which errors unless the pill list is on screen. The first render and each screen change
// take a few polls, and a UiScrollable over a scrollable that is not on screen is an HTTP error, like UiAutomator2.
function fakeApp({missing=[],enabledCheckout=false,ready=true,coldPolls=3,staleLine=false,screenshotFails=false,settingsIgnored=false,textLag=2}={}){
 const s={screen:'catalogue',basket:false,qty:0,shownQty:0,lag:0,pos:'top',hpos:'start',pendingPolls:coldPolls},log=[];
 const top=['sut-search','sut-cart-open','sut-category-all','sut-category-food','sut-category-groceries','sut-category-shops','sut-category-gifts','sut-product-pizza','sut-add-pizza','sut-open-product-pizza'];
 const pills={start:['sut-category-all','sut-category-food','sut-category-groceries'],end:['sut-category-groceries','sut-category-shops','sut-category-gifts']};
 const bottom=()=>[...(s.basket?['sut-cart-summary','sut-checkout-disabled','sut-cart-screen-open']:[]),'sut-product-bread','sut-add-bread','sut-open-product-bread','sut-language-en','sut-language-cs','sut-language-de'];
 const content=()=>s.screen==='catalogue'?[...top,...bottom()]:onScreen();
 const onScreen=()=>{
  let v;
  if(s.screen==='catalogue'){
   v=s.pos==='top'?top.filter(x=>!x.startsWith('sut-category-')||pills[s.hpos].includes(x)):bottom();
   if(s.basket&&s.pos==='top')v=[...v,'sut-cart-summary'];
  }else if(s.screen==='detail')v=['sut-detail-screen','sut-detail-title','sut-detail-price','sut-detail-add','sut-detail-quantity','sut-nav-back','sut-nav-cart'];
  else{
   v=['sut-cart-screen','sut-cart-subtotal','sut-cart-prototype-note','sut-cart-checkout-disabled','sut-nav-back'];
   v.push(...(s.qty>0?['sut-cart-line-pizza','sut-cart-increase-pizza','sut-cart-decrease-pizza','sut-cart-remove-pizza','sut-cart-quantity-pizza']:['sut-cart-empty']));
  }
  return v.filter(x=>!missing.includes(x));
 };
 const rendered=()=>s.pendingPolls>0?[]:onScreen();
 const text=id=>id==='sut-detail-quantity'?`In your cart: ${s.shownQty}`:id==='sut-cart-quantity-pizza'?String(s.shownQty):'';
 const enabled=id=>id.includes('checkout-disabled')?enabledCheckout:true;
 const tap=id=>{
  const before=s.screen;
  if(id==='sut-add-pizza'||id==='sut-detail-add'||id==='sut-cart-increase-pizza')s.qty++;
  else if(id==='sut-cart-decrease-pizza')s.qty=Math.max(0,s.qty-1);
  else if(id==='sut-cart-remove-pizza')s.qty=0;
  else if(id==='sut-cart-open')s.basket=!s.basket;
  else if(id==='sut-open-product-pizza')s.screen='detail';
  else if(id==='sut-nav-cart')s.screen='cart';
  if(s.screen!==before)s.pendingPolls=2;
  s.lag=textLag;
 };
 const scroll=value=>{
  const target=/resourceId\("([^"]+)"\)/.exec(value)?.[1],toPills=/scrollIntoView\(new UiSelector\(\)\.className\("android.widget.HorizontalScrollView"\)\)/.test(value);
  if(s.screen!=='catalogue')return onScreen().includes(target)?[target]:[];
  if(value.includes('setAsHorizontalList')){
   if(s.pos!=='top')throw new Error('Appium HTTP 500: UiObjectNotFoundException: HorizontalScrollView');
   if(pills.end.includes(target)&&!pills.start.includes(target))s.hpos='end';
   else if(pills.start.includes(target))s.hpos='start';
   return onScreen().includes(target)?[target]:[];
  }
  if(toPills){s.pos='top';return ['pills']}
  if(top.includes(target)&&!target.startsWith('sut-category-')){s.pos='top';return onScreen().includes(target)?[target]:[]}
  if(bottom().includes(target)){s.pos='bottom';return onScreen().includes(target)?[target]:[]}
  s.pos='bottom';
  return [];
 };
 const call=async(method,path,body)=>{
  log.push(`${method} ${path}`);
  if(path==='/status')return {ready};
  if(method==='POST'&&path==='/session')return {sessionId:'s1'};
  if(path.endsWith('/appium/settings'))return method==='GET'?(settingsIgnored?{}:{disableIdLocatorAutocompletion:true}):null;
  if(path.endsWith('/elements')){
   if(body.using==='id'){
    if(s.pendingPolls>0){s.pendingPolls--;return []}
    const stale=staleLine&&body.value==='sut-cart-line-pizza'&&s.screen==='cart'&&s.qty===0;
    return [...rendered().filter(x=>x===body.value),...(stale?[body.value]:[])].map(x=>({[ELEMENT]:`${x}#0`}));
   }
   return scroll(body.value).map(x=>({[ELEMENT]:`${x}#ui`}));
  }
  const id=decodeURIComponent(path.split('/element/')[1]??'').split('#')[0];
  if(path.endsWith('/displayed'))return rendered().includes(id);
  if(path.endsWith('/click')){tap(id);return null}
  if(path.endsWith('/enabled'))return enabled(id);
  if(path.endsWith('/text')){if(s.lag>0)s.lag--;else s.shownQty=s.qty;return text(id)}
  if(path.endsWith('/source')){
   if(s.lag===0)s.shownQty=s.qty;
   const nodes=[...rendered(),...(staleLine&&s.screen==='cart'&&s.qty===0?['sut-cart-line-pizza']:[])];
   return `<hierarchy>${nodes.map(x=>`<android.view.View index="0" text="${text(x)}" resource-id="${x}" enabled="${enabled(x)}" displayed="true"/>`).join('')}</hierarchy>`;
  }
  if(path.endsWith('/screenshot')){if(screenshotFails)throw new Error('Appium HTTP 500: screenshot failed');return Buffer.from('png').toString('base64')}
  return null;
 };
 return {call,log,state:s,content};
}
const run=async(opts,c=contract)=>{const out=tmp(),{call,log}=fakeApp(opts);const report=await walk(c,core,call,out,{timeout:400,firstTimeout:2000,poll:20});return {out,log,report,verdict:verifyWalk(c,core,report,out)}};

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
 const scrolled=report.ids.filter(e=>e.scrolled).map(e=>e.id);
 const offscreen=['sut-category-shops','sut-category-gifts','sut-product-bread','sut-add-bread','sut-open-product-bread','sut-language-en','sut-language-cs','sut-language-de','sut-checkout-disabled','sut-cart-screen-open'];
 assert.ok(scrolled.every(id=>offscreen.includes(id)),scrolled.join());
 assert.ok(scrolled.includes('sut-category-shops')&&scrolled.includes('sut-checkout-disabled'),scrolled.join());
 assert.ok(log.indexOf('POST /session/s1/appium/settings')<log.findIndex(l=>l.endsWith('/elements')));
 assert.ok(log.includes('DELETE /session/s1'));
 for(const e of report.ids)assert.match(readFileSync(join(out,e.file),'utf8'),new RegExp(`resource-id="${e.id}"`));
 assert.ok(readdirSync(out).filter(f=>f.endsWith('.xml')).length>=PLAN.length);
 assert.deepEqual(report.checks.filter(c=>c.check==='disabled').map(c=>[c.id,c.actual]),[['sut-checkout-disabled',false],['sut-cart-checkout-disabled',false],['sut-cart-checkout-disabled',false]]);
 assert.deepEqual(report.checks.filter(c=>c.check==='text').map(c=>c.actual),['In your cart: 1','In your cart: 2','2','3','2']);
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
 assert.match(verifyWalk(contract,core,{...report,checks:report.checks.filter(c=>c.id!=='sut-cart-checkout-disabled')},out).reason,/disabled sut-cart-checkout-disabled on cart-screen not proven/);
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
  const env={APPIUM_URL:`http://127.0.0.1:${server.address().port}`,STEP_TIMEOUT_MS:'400',FIRST_STEP_TIMEOUT_MS:'2000',POLL_MS:'20'};
  const walked=await cli('contract-walk.mjs',[contractPath,out],env);
  server.close();
  assert.equal(walked.code,code,walked.output);
  assert.equal((await cli('verify-contract-walk.mjs',[contractPath,out])).code,code);
 }
 const empty=await cli('verify-contract-walk.mjs',[contractPath,tmp()]);
 assert.equal(empty.code,1);
 assert.match(empty.output,/report\.json missing/);
});

test('the verifier requires every planned check, proven in the saved tree',async()=>{
 const {out,report}=await run({});
 const onlyDisabled=report.checks.filter(c=>c.check==='disabled');
 assert.match(verifyWalk(contract,core,{...report,checks:onlyDisabled,assertions:report.expected+onlyDisabled.length},out).reason,/text sut-detail-quantity on product-detail not proven/);
 const proof=report.checks.find(c=>c.check==='disabled'&&c.state==='mini-cart');
 writeFileSync(join(out,proof.file),readFileSync(join(out,proof.file),'utf8').replace(/(resource-id="sut-checkout-disabled" enabled=")false/,'$1true'));
 assert.match(verifyWalk(contract,core,report,out).reason,/tree does not show enabled="false"/);
 const moved={...report,ids:report.ids.map(e=>e.id==='sut-nav-back'?{...e,file:report.states[0].files[0]}:e)};
 assert.match(verifyWalk(contract,core,moved,out).reason,/sut-nav-back evidence .* is not from product-detail/);
});

test('a cart line that stays in the tree after removal fails the gone check',async()=>{
 const {report,verdict}=await run({staleLine:true});
 assert.equal(report.outcome,'failed');
 assert.match(report.error,/gone sut-cart-line-pizza on cart-empty/);
 assert.equal(verdict.ok,false);
});

test('screenshot errors, ignored settings and a missing pill are never a pass',async()=>{
 assert.equal((await run({screenshotFails:true})).report.outcome,'infrastructure-failed');
 const ignored=await run({settingsIgnored:true});
 assert.equal(ignored.report.outcome,'infrastructure-failed');
 assert.match(ignored.report.error,/disableIdLocatorAutocompletion/);
 const pill=await run({missing:['sut-category-gifts']});
 assert.equal(pill.report.outcome,'failed');
 assert.match(pill.report.error,/missing sut-category-gifts on catalogue/);
});

test('a slow cold start is waited for before the first tree is captured',async()=>{
 const {report,out}=await run({coldPolls:6});
 assert.equal(report.outcome,'passed',report.error);
 assert.match(readFileSync(join(out,report.states[0].files[0]),'utf8'),/resource-id="sut-search"/);
});

test('the verifier rejects each kind of unproven or misattributed evidence',async()=>{
 const {out,report}=await run({});
 const edit=(file,from,to)=>{const p=join(out,file),x=readFileSync(p,'utf8');assert.ok(x.includes(from),from);writeFileSync(p,x.replace(from,to));return ()=>writeFileSync(p,x)};
 const text=report.checks.find(c=>c.check==='text'&&c.state==='cart-increase');
 let undo=edit(text.file,'text="3" resource-id="sut-cart-quantity-pizza"','text="4" resource-id="sut-cart-quantity-pizza"');
 assert.match(verifyWalk(contract,core,report,out).reason,/text sut-cart-quantity-pizza on cart-increase: tree does not show text "3"/);
 undo();
 const gone=report.checks.find(c=>c.check==='gone');
 undo=edit(gone.file,'</hierarchy>','<node resource-id="sut-cart-line-pizza"/></hierarchy>');
 assert.match(verifyWalk(contract,core,report,out).reason,/gone sut-cart-line-pizza on cart-empty: still in/);
 undo();
 const moved={...report,checks:report.checks.map(c=>c===text?{...c,file:report.checks.find(x=>x.state==='cart-decrease').file}:c)};
 assert.match(verifyWalk(contract,core,moved,out).reason,/evidence .* is not from cart-increase/);
 assert.match(verifyWalk(contract,core,{...report,evidenceErrors:['screenshot failed']},out).reason,/evidence or cleanup errors/);
 assert.match(verifyWalk(contract,core,{...report,assertions:report.assertions-1},out).reason,/assertion count/);
 assert.ok(verifyWalk(contract,core,report,out).ok);
});

test('a contract checkout control without a disabled check in the plan fails',()=>{
 const c=clone(contract);
 c.native.selectors.detailCheckoutDisabled='sut-detail-title';
 assert.throws(()=>requiredChecks(c),/detailCheckoutDisabled: checkout control has no disabled check/);
});

test('tree attributes are decoded and matched by exact resource-id',()=>{
 const xml='<hierarchy><node text="Tom &amp; Jerry &#8364;1 &gt; 0" resource-id="sut-a-b" enabled="false"/><node resource-id="sut-a" text="x"/></hierarchy>';
 assert.deepEqual([nodeAttributes(xml,'sut-a-b').text,nodeAttributes(xml,'sut-a').text,nodeAttributes(xml,'sut-a-b').enabled],['Tom & Jerry \u20ac1 > 0','x','false']);
 assert.equal(nodeAttributes(xml,'sut-b'),null);
});

test('text that updates a few polls after a tap is waited for',async()=>{
 const {report}=await run({textLag:4});
 assert.equal(report.outcome,'passed',report.error);
 const {report:slow}=await run({textLag:1000});
 assert.equal(slow.outcome,'failed');
 assert.match(slow.error,/text sut-detail-quantity on product-detail/);
});
