#!/usr/bin/env node
// Runtime check of the native SUT contract on Android: drives the app through every screen that carries contract IDs
// and asserts each native ID (selectors plus fixture-instantiated templates) resolves by `id` in the UiAutomator tree.
// Saves the UiAutomator XML tree and a screenshot per screen (and after each scroll) as evidence.
// Usage: node --experimental-strip-types contract-walk.mjs <contracts/sut.json> <outDir>
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {client} from './run-case.mjs';

const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
export const SETTINGS={disableIdLocatorAutocompletion:true};
export const CHECKOUT_IDS=['sut-checkout-disabled','sut-cart-checkout-disabled'];

/** Screens in the order the walk reaches them. `enter` taps (by id) lead from the previous screen. */
export const PLAN=[
 {name:'catalogue',enter:[],horizontal:'sut-category-',expect:['selectors.search','selectors.cartOpen','selectors.productPizza','selectors.addPizza','selectors.openProductPizza','selectors.categoryGroceries','selectors.languageEnglish','selectors.languageCzech','selectorTemplates.product','selectorTemplates.add','selectorTemplates.openProduct','selectorTemplates.category','selectorTemplates.language']},
 {name:'mini-cart',enter:['sut-add-pizza','sut-cart-open'],expect:['selectors.cartSummary','selectors.checkoutDisabled','selectors.cartScreenOpen'],disabled:['sut-checkout-disabled']},
 {name:'product-detail',enter:['sut-open-product-pizza'],expect:['selectors.detailScreen','selectors.detailTitle','selectors.detailPrice','selectors.detailAdd','selectors.detailQuantity','selectors.navBack','selectors.navCart'],text:{'sut-detail-quantity':'In your cart: 1'}},
 {name:'cart-screen',enter:['sut-detail-add','sut-nav-cart'],expect:['selectors.cartScreen','selectors.cartLinePizza','selectors.cartIncreasePizza','selectors.cartDecreasePizza','selectors.cartRemovePizza','selectors.cartQuantityPizza','selectors.cartSubtotal','selectors.cartPrototypeNote','selectors.cartCheckoutDisabled','selectorTemplates.cartLine','selectorTemplates.cartIncrease','selectorTemplates.cartDecrease','selectorTemplates.cartRemove','selectorTemplates.cartQuantity'],disabled:['sut-cart-checkout-disabled'],text:{'sut-cart-quantity-pizza':'2'}},
 {name:'cart-increase',enter:['sut-cart-increase-pizza'],expect:[],text:{'sut-cart-quantity-pizza':'3'}},
 {name:'cart-decrease',enter:['sut-cart-decrease-pizza'],expect:[],text:{'sut-cart-quantity-pizza':'2'}},
 {name:'cart-empty',enter:['sut-cart-remove-pizza'],expect:['selectors.cartEmpty'],disabled:['sut-cart-checkout-disabled'],gone:['sut-cart-line-pizza']}
];

/** Placeholder values: product templates use the contract fixtures; cart templates the product put in the cart. */
export function placeholderValues(contract,core){
 return {
  productId:contract.fixtures.products.map(p=>p.id),
  category:['all',...core.categories.map(c=>c.toLowerCase())],
  language:[...core.languages]
 };
}
const CART_TEMPLATE=/^selectorTemplates\.cart/;

/** Every native contract ID with the screen it must resolve on. Throws when a contract key has no screen in PLAN. */
export function expectedIds(contract,values){
 const screenOf=new Map(PLAN.flatMap(s=>s.expect.map(k=>[k,s.name])));
 const out=[];
 const add=(key,id)=>{
  const state=screenOf.get(key);
  if(!state)throw new Error(`contract key native.${key} has no screen in the walk plan`);
  const same=out.find(e=>e.id===id&&e.state===state);
  if(same)same.keys.push(key);else out.push({keys:[key],id,state});
 };
 for(const [k,id] of Object.entries(contract.native.selectors))add(`selectors.${k}`,id);
 for(const [k,template] of Object.entries(contract.native.selectorTemplates??{})){
  const names=[...template.matchAll(/\{(\w+)\}/g)].map(m=>m[1]);
  if(names.length!==1)throw new Error(`native.selectorTemplates.${k}: expected one placeholder`);
  const key=`selectorTemplates.${k}`;
  const vals=CART_TEMPLATE.test(key)?['pizza']:values[names[0]];
  if(!vals?.length)throw new Error(`native.selectorTemplates.${k}: no values for {${names[0]}}`);
  for(const v of vals)add(key,template.replace(`{${names[0]}}`,v));
 }
 return out;
}

const scrollers=id=>[
 `new UiScrollable(new UiSelector().className("android.widget.HorizontalScrollView")).setAsHorizontalList().scrollIntoView(new UiSelector().resourceId("${id}"))`,
 `new UiScrollable(new UiSelector().className("android.widget.ScrollView")).scrollIntoView(new UiSelector().resourceId("${id}"))`
];

export async function walk(contract,core,call,folder,{timeout=15000,firstTimeout=timeout,extra={}}={}){
 const report={contractVersion:contract.version,platform:'android',settings:SETTINGS,expected:0,states:[],ids:[],checks:[],missing:[],assertions:0,outcome:'infrastructure-failed'};
 let expected=[];
 mkdirSync(folder,{recursive:true});
 let session,device,shot=0;
 const capture=async name=>{
  const file=`${String(++shot).padStart(2,'0')}-${name}`;
  writeFileSync(join(folder,file+'.xml'),await device('GET','/source'));
  try{writeFileSync(join(folder,file+'.png'),Buffer.from(await device('GET','/screenshot'),'base64'))}catch(e){(report.evidenceErrors??=[]).push(e.message)}
  return file+'.xml';
 };
 const visible=async id=>{
  const out=[];
  for(const m of await device('POST','/elements',{using:'id',value:id}))
   if(await device('GET',`/element/${encodeURIComponent(m[ELEMENT])}/displayed`))out.push(`/element/${encodeURIComponent(m[ELEMENT])}`);
  return out;
 };
 const scrollTo=async id=>{
  for(const value of scrollers(id)){
   try{if((await device('POST','/elements',{using:'-android uiautomator',value})).length)return true}catch{}
  }
  return false;
 };
 const find=async(id,wait)=>{
  const end=Date.now()+wait;
  while(true){
   const hits=await visible(id);
   if(hits.length)return {hits,scrolled:false};
   if(await scrollTo(id)){const again=await visible(id);if(again.length)return {hits:again,scrolled:true}}
   if(Date.now()>=end)return {hits:[],scrolled:false};
   await new Promise(r=>setTimeout(r,350));
  }
 };
 try{
  expected=expectedIds(contract,placeholderValues(contract,core));
  report.expected=expected.length;
  if(!(await call('GET','/status'))?.ready)throw new Error('Appium server is not ready');
  const caps={...extra,platformName:'android','appium:automationName':'UiAutomator2','appium:noReset':false,'appium:appPackage':contract.native.androidPackage};
  session='/session/'+(await call('POST','/session',{capabilities:{alwaysMatch:caps}})).sessionId;
  device=(method,path,body)=>call(method,session+path,body);
  await device('POST','/appium/settings',{settings:SETTINGS});
  for(const [i,state] of PLAN.entries()){
   for(const id of state.enter){
    const {hits}=await find(id,timeout);
    if(hits.length!==1)throw new Error(`${state.name}: cannot tap ${id} (${hits.length} visible)`);
    await device('POST',hits[0]+'/click',{});
   }
   const anchor=expected.find(e=>e.state===state.name)?.id;
   if(anchor)await find(anchor,i===0?firstTimeout:timeout);
   const file=await capture(state.name);
   report.states.push({name:state.name,enter:state.enter,files:[file]});
   const pending=[];
   for(const e of expected.filter(e=>e.state===state.name)){
    const hits=await visible(e.id);
    if(hits.length)report.ids.push({...e,file,count:hits.length,scrolled:false,element:hits[0]});
    else pending.push(e);
   }
   if(state.horizontal)pending.sort((x,y)=>Number(y.id.startsWith(state.horizontal))-Number(x.id.startsWith(state.horizontal)));
   for(const e of pending){
    const {hits,scrolled}=await find(e.id,0);
    if(!hits.length){report.missing.push(e);continue}
    const shotFile=await capture(`${state.name}-${e.id}`);
    report.states.at(-1).files.push(shotFile);
    report.ids.push({...e,file:shotFile,count:hits.length,scrolled,element:hits[0]});
   }
   report.assertions+=expected.filter(e=>e.state===state.name).length;
   for(const id of state.disabled??[]){
    const {hits}=await find(id,timeout);
    const enabled=hits.length?await device('GET',hits[0]+'/enabled'):null;
    report.checks.push({state:state.name,id,check:'disabled',ok:enabled===false,actual:enabled});
   }
   for(const [id,text] of Object.entries(state.text??{})){
    const end=Date.now()+timeout;
    let actual=null;
    while(true){
     const {hits}=await find(id,0);
     actual=hits.length?await device('GET',hits[0]+'/text'):null;
     if(actual===text||Date.now()>=end)break;
     await new Promise(r=>setTimeout(r,350));
    }
    report.checks.push({state:state.name,id,check:'text',expected:text,actual,ok:actual===text});
   }
   for(const id of state.gone??[]){
    const hits=await visible(id);
    report.checks.push({state:state.name,id,check:'gone',ok:hits.length===0,actual:hits.length});
   }
  }
  report.assertions+=report.checks.length;
  for(const e of report.ids)delete e.element;
  const failed=report.checks.filter(c=>!c.ok);
  report.outcome=report.missing.length||failed.length?'failed':'passed';
  if(report.outcome==='failed')report.error=[...report.missing.map(m=>`missing ${m.id??m.reason} on ${m.state}`),...failed.map(c=>`${c.check} ${c.id} on ${c.state}: ${JSON.stringify(c.actual)}`)].join('; ');
 }catch(e){
  report.error=e.message;
 }finally{
  if(session){try{await call('DELETE',session)}catch(e){report.cleanupError=e.message}}
  for(const e of report.ids)delete e.element;
  writeFileSync(join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}

/** Independent fail-closed verdict: recomputes the expected IDs from the contract and checks the saved XML trees. */
export function verifyWalk(contract,core,report,folder,read=p=>readFileSync(p,'utf8')){
 if(!report)return {ok:false,reason:'report.json missing or unreadable'};
 if(report.contractVersion!==contract.version)return {ok:false,reason:`report is for contract ${report.contractVersion}, expected ${contract.version}`};
 if(report.settings?.disableIdLocatorAutocompletion!==true)return {ok:false,reason:'walk did not run with disableIdLocatorAutocompletion'};
 let expected;
 try{expected=expectedIds(contract,placeholderValues(contract,core))}catch(e){return {ok:false,reason:e.message}}
 if(!expected.length||!(report.assertions>0))return {ok:false,reason:'zero assertions'};
 if(report.outcome!=='passed')return {ok:false,reason:`outcome ${report.outcome}${report.error?`: ${report.error}`:''}`};
 const ids=Array.isArray(report.ids)?report.ids:[];
 const problems=[];
 for(const e of expected){
  const hit=ids.find(x=>x.id===e.id&&x.state===e.state);
  if(!hit){problems.push(`${e.id} not resolved on ${e.state}`);continue}
  let xml='';
  try{xml=read(join(folder,hit.file))}catch{problems.push(`${hit.file} missing`);continue}
  if(!xml.includes(`resource-id="${e.id}"`))problems.push(`${e.id} absent from ${hit.file}`);
 }
 const checks=Array.isArray(report.checks)?report.checks:[];
 for(const id of CHECKOUT_IDS)if(!checks.some(c=>c.id===id&&c.check==='disabled'&&c.ok&&c.actual===false))problems.push(`${id} not proven disabled`);
 if(checks.some(c=>!c.ok))problems.push('a check failed');
 if(report.assertions!==expected.length+checks.length)problems.push(`assertion count ${report.assertions} != ${expected.length+checks.length}`);
 return problems.length?{ok:false,reason:problems.slice(0,10).join('; ')}:{ok:true,reason:`${expected.length} native contract IDs resolved by id on ${PLAN.length} screens, ${checks.length} checks passed`};
}

export async function loadCore(){
 const core=await import('../../../packages/core/src/index.ts');
 return {categories:core.categories,languages:core.languages};
}

if(process.argv[1]&&realpathSync(fileURLToPath(import.meta.url))===realpathSync(process.argv[1])){
 const [contractPath,outDir]=process.argv.slice(2);
 if(!contractPath||!outDir){console.error('usage: contract-walk.mjs <contracts/sut.json> <outDir>');process.exit(2)}
 const contract=JSON.parse(readFileSync(contractPath,'utf8')),core=await loadCore();
 const report=await walk(contract,core,client(process.env.APPIUM_URL??'http://127.0.0.1:4723'),outDir,{
  timeout:Number(process.env.STEP_TIMEOUT_MS??15000),
  firstTimeout:Number(process.env.FIRST_STEP_TIMEOUT_MS??90000),
  extra:{'appium:appActivity':'.MainActivity','appium:forceAppLaunch':true,'appium:autoGrantPermissions':true,'appium:newCommandTimeout':300,'appium:uiautomator2ServerLaunchTimeout':120000,'appium:uiautomator2ServerInstallTimeout':120000,'appium:adbExecTimeout':120000}
 });
 const result=verifyWalk(contract,core,report,outDir);
 console.log(`${report.outcome} ${join(outDir,'report.json')}${report.error?` :: ${report.error}`:''}`);
 console.log(`verdict: ${result.reason}`);
 process.exit(result.ok?0:1);
}
