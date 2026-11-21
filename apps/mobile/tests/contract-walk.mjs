#!/usr/bin/env node
// Runtime check of the native SUT contract on Android: drives the app through every screen that carries contract IDs
// and asserts each native ID (selectors plus fixture-instantiated templates) resolves by `id` in the UiAutomator tree.
// Saves the UiAutomator XML tree and a screenshot per screen, and after each scroll or check, as evidence.
// Usage: node --experimental-strip-types contract-walk.mjs <contracts/sut.json> <outDir>
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {client} from './run-case.mjs';

const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
export const SETTINGS={disableIdLocatorAutocompletion:true};

/** Screens in the order the walk reaches them. `enter` taps (by id) lead from the previous screen.
 * `horizontal` marks IDs that live in the horizontal category list inside the vertical catalogue. */
export const PLAN=[
 {name:'catalogue',enter:[],horizontal:'sut-category-',expect:['selectors.search','selectors.cartOpen','selectors.productPizza','selectors.addPizza','selectors.openProductPizza','selectors.categoryGroceries','selectors.languageEnglish','selectors.languageCzech','selectorTemplates.product','selectorTemplates.add','selectorTemplates.openProduct','selectorTemplates.category','selectorTemplates.language']},
 {name:'mini-cart',enter:['sut-add-pizza','sut-cart-open'],expect:['selectors.cartSummary','selectors.checkoutDisabled','selectors.cartScreenOpen'],disabled:['sut-checkout-disabled']},
 {name:'product-detail',enter:['sut-open-product-pizza'],expect:['selectors.detailScreen','selectors.detailTitle','selectors.detailPrice','selectors.detailAdd','selectors.detailQuantity','selectors.navBack','selectors.navCart'],text:{'sut-detail-quantity':'In your cart: 1'}},
 {name:'detail-added',enter:['sut-detail-add'],expect:[],text:{'sut-detail-quantity':'In your cart: 2'}},
 {name:'cart-screen',enter:['sut-nav-cart'],expect:['selectors.cartScreen','selectors.cartLinePizza','selectors.cartIncreasePizza','selectors.cartDecreasePizza','selectors.cartRemovePizza','selectors.cartQuantityPizza','selectors.cartSubtotal','selectors.cartPrototypeNote','selectors.cartCheckoutDisabled','selectorTemplates.cartLine','selectorTemplates.cartIncrease','selectorTemplates.cartDecrease','selectorTemplates.cartRemove','selectorTemplates.cartQuantity'],disabled:['sut-cart-checkout-disabled'],text:{'sut-cart-quantity-pizza':'2'}},
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

/** Checks the walk must record, from PLAN. Every native checkout control in the contract must be proven disabled. */
export function requiredChecks(contract){
 const checks=PLAN.flatMap(s=>[
  ...(s.disabled??[]).map(id=>({state:s.name,id,check:'disabled'})),
  ...Object.entries(s.text??{}).map(([id,expected])=>({state:s.name,id,check:'text',expected})),
  ...(s.gone??[]).map(id=>({state:s.name,id,check:'gone'}))
 ]);
 for(const [k,id] of Object.entries(contract.native.selectors))
  if(/checkout/i.test(k)&&!checks.some(c=>c.check==='disabled'&&c.id===id))throw new Error(`native.selectors.${k}: checkout control has no disabled check in the walk plan`);
 return checks;
}

/** The attributes of the UiAutomator node with this resource-id, or null. */
export function nodeAttributes(xml,id){
 const tag=new RegExp(`<[^<>]*\\bresource-id="${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^<>]*>`).exec(xml)?.[0];
 return tag?Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])):null;
}

const vertical=target=>`new UiScrollable(new UiSelector().scrollable(true).className("android.widget.ScrollView")).scrollIntoView(${target})`;
const horizontal=target=>`new UiScrollable(new UiSelector().scrollable(true).className("android.widget.HorizontalScrollView")).setAsHorizontalList().scrollIntoView(${target})`;
const byId=id=>`new UiSelector().resourceId("${id}")`;

export async function walk(contract,core,call,folder,{timeout=15000,firstTimeout=timeout,extra={}}={}){
 const report={contractVersion:contract.version,platform:'android',settings:null,expected:0,states:[],ids:[],checks:[],missing:[],assertions:0,outcome:'infrastructure-failed'};
 mkdirSync(folder,{recursive:true});
 let session,device,shot=0,expected=[],required=[];
 const capture=async name=>{
  const file=`${String(++shot).padStart(2,'0')}-${name}.xml`,xml=await device('GET','/source');
  writeFileSync(join(folder,file),xml);
  try{writeFileSync(join(folder,file.replace(/\.xml$/,'.png')),Buffer.from(await device('GET','/screenshot'),'base64'))}catch(e){(report.evidenceErrors??=[]).push(e.message)}
  return {file,xml};
 };
 const visible=async id=>{
  const out=[];
  for(const m of await device('POST','/elements',{using:'id',value:id})){
   const element=`/element/${encodeURIComponent(m[ELEMENT])}`;
   if(await device('GET',element+'/displayed'))out.push(element);
  }
  return out;
 };
 const uiautomator=async value=>{try{return (await device('POST','/elements',{using:'-android uiautomator',value})).length>0}catch{return false}};
 const scrollTo=async(id,inHorizontal)=>inHorizontal
  ?(await uiautomator(vertical('new UiSelector().className("android.widget.HorizontalScrollView")')))&&uiautomator(horizontal(byId(id)))
  :uiautomator(vertical(byId(id)));
 const find=async(id,wait,inHorizontal=false)=>{
  const end=Date.now()+wait;
  while(true){
   const hits=await visible(id);
   if(hits.length)return {hits,scrolled:false};
   if(await scrollTo(id,inHorizontal)){const again=await visible(id);if(again.length)return {hits:again,scrolled:true}}
   if(Date.now()>=end)return {hits:[],scrolled:false};
   await new Promise(r=>setTimeout(r,350));
  }
 };
 try{
  expected=expectedIds(contract,placeholderValues(contract,core));
  required=requiredChecks(contract);
  report.expected=expected.length;
  if(!(await call('GET','/status'))?.ready)throw new Error('Appium server is not ready');
  const caps={...extra,platformName:'android','appium:automationName':'UiAutomator2','appium:noReset':true,'appium:appPackage':contract.native.androidPackage};
  session='/session/'+(await call('POST','/session',{capabilities:{alwaysMatch:caps}})).sessionId;
  device=(method,path,body)=>call(method,session+path,body);
  await device('POST','/appium/settings',{settings:SETTINGS});
  report.settings=await device('GET','/appium/settings');
  if(report.settings?.disableIdLocatorAutocompletion!==true)throw new Error('UiAutomator2 did not apply disableIdLocatorAutocompletion');
  for(const [i,state] of PLAN.entries()){
   const inHorizontal=id=>!!state.horizontal&&id.startsWith(state.horizontal);
   for(const id of state.enter){
    const {hits}=await find(id,timeout);
    if(hits.length!==1)throw new Error(`${state.name}: cannot tap ${id} (${hits.length} visible)`);
    await device('POST',hits[0]+'/click',{});
   }
   const mine=expected.filter(e=>e.state===state.name);
   const anchor=mine[0]?.id??Object.keys(state.text??{})[0]??state.disabled?.[0];
   if(anchor)await find(anchor,i===0?firstTimeout:timeout,inHorizontal(anchor));
   const first=await capture(state.name);
   const record={name:state.name,enter:state.enter,files:[first.file]};
   report.states.push(record);
   const pending=[];
   for(const e of mine){
    const hits=await visible(e.id);
    if(hits.length&&nodeAttributes(first.xml,e.id))report.ids.push({...e,file:first.file,count:hits.length,scrolled:false});
    else pending.push(e);
   }
   for(const e of pending){
    const {hits,scrolled}=await find(e.id,0,inHorizontal(e.id));
    if(!hits.length){report.missing.push(e);continue}
    const shotFile=await capture(`${state.name}-${e.id}`);
    record.files.push(shotFile.file);
    report.ids.push({...e,file:shotFile.file,count:hits.length,scrolled});
   }
   report.assertions+=mine.length;
   for(const c of required.filter(c=>c.state===state.name)){
    if(c.check==='gone'){
     const ok=!nodeAttributes(first.xml,c.id)&&(await visible(c.id)).length===0;
     report.checks.push({...c,file:first.file,ok,actual:ok?'absent':'present'});
     continue;
    }
    const end=Date.now()+timeout;
    let actual=null,hits=[];
    while(true){
     ({hits}=await find(c.id,0));
     actual=!hits.length?null:c.check==='disabled'?await device('GET',hits[0]+'/enabled'):await device('GET',hits[0]+'/text');
     if((c.check==='disabled'?actual===false:actual===c.expected)||Date.now()>=end)break;
     await new Promise(r=>setTimeout(r,350));
    }
    const proof=await capture(`${state.name}-${c.check}-${c.id}`);
    record.files.push(proof.file);
    const node=nodeAttributes(proof.xml,c.id);
    const ok=c.check==='disabled'?actual===false&&node?.enabled==='false':actual===c.expected&&node?.text===c.expected;
    report.checks.push({...c,file:proof.file,ok,actual});
   }
  }
  report.assertions+=report.checks.length;
  const failed=report.checks.filter(c=>!c.ok);
  report.outcome=report.missing.length||failed.length?'failed':'passed';
  if(report.outcome==='failed')report.error=[...report.missing.map(m=>`missing ${m.id} on ${m.state}`),...failed.map(c=>`${c.check} ${c.id} on ${c.state}: ${JSON.stringify(c.actual)}`)].join('; ');
 }catch(e){
  report.error=e.message;
 }finally{
  if(session){try{await call('DELETE',session)}catch(e){report.cleanupError=e.message}}
  if(report.outcome==='passed'&&(report.evidenceErrors||report.cleanupError))report.outcome='infrastructure-failed';
  writeFileSync(join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}

/** Independent fail-closed verdict: recomputes the expected IDs and checks from the contract and PLAN,
 * and re-reads every saved UiAutomator tree the report cites. */
export function verifyWalk(contract,core,report,folder,read=p=>readFileSync(p,'utf8')){
 if(!report)return {ok:false,reason:'report.json missing or unreadable'};
 if(report.contractVersion!==contract.version)return {ok:false,reason:`report is for contract ${report.contractVersion}, expected ${contract.version}`};
 if(report.settings?.disableIdLocatorAutocompletion!==true)return {ok:false,reason:'walk did not run with disableIdLocatorAutocompletion'};
 let expected,required;
 try{expected=expectedIds(contract,placeholderValues(contract,core));required=requiredChecks(contract)}catch(e){return {ok:false,reason:e.message}}
 if(!expected.length||!(report.assertions>0))return {ok:false,reason:'zero assertions'};
 if(report.outcome!=='passed')return {ok:false,reason:`outcome ${report.outcome}${report.error?`: ${report.error}`:''}`};
 if(report.evidenceErrors?.length||report.cleanupError)return {ok:false,reason:'evidence or cleanup errors'};
 const xmlOf=file=>{try{return read(join(folder,file))}catch{return null}};
 const fromState=(file,state)=>typeof file==='string'&&new RegExp(`^\\d{2}-${state}(-|\\.xml$)`).test(file);
 const problems=[];
 const ids=Array.isArray(report.ids)?report.ids:[];
 for(const e of expected){
  const hit=ids.find(x=>x.id===e.id&&x.state===e.state);
  if(!hit){problems.push(`${e.id} not resolved on ${e.state}`);continue}
  if(!fromState(hit.file,e.state)){problems.push(`${e.id} evidence ${hit.file} is not from ${e.state}`);continue}
  const xml=xmlOf(hit.file);
  if(xml===null)problems.push(`${hit.file} missing`);
  else if(!nodeAttributes(xml,e.id))problems.push(`${e.id} absent from ${hit.file}`);
 }
 const checks=Array.isArray(report.checks)?report.checks:[];
 for(const c of required){
  const hit=checks.find(x=>x.state===c.state&&x.id===c.id&&x.check===c.check&&x.ok===true);
  const label=`${c.check} ${c.id} on ${c.state}`;
  if(!hit){problems.push(`${label} not proven`);continue}
  if(!fromState(hit.file,c.state)){problems.push(`${label} evidence ${hit.file} is not from ${c.state}`);continue}
  const xml=xmlOf(hit.file);
  if(xml===null){problems.push(`${hit.file} missing`);continue}
  const node=nodeAttributes(xml,c.id);
  if(c.check==='disabled'&&!(hit.actual===false&&node?.enabled==='false'))problems.push(`${label}: tree does not show enabled="false"`);
  if(c.check==='text'&&!(hit.actual===c.expected&&node?.text===c.expected))problems.push(`${label}: tree does not show text "${c.expected}"`);
  if(c.check==='gone'&&node)problems.push(`${label}: still in ${hit.file}`);
 }
 if(report.assertions!==expected.length+required.length)problems.push(`assertion count ${report.assertions} != ${expected.length+required.length}`);
 return problems.length?{ok:false,reason:problems.slice(0,10).join('; ')}:{ok:true,reason:`${expected.length} native contract IDs resolved by id on ${PLAN.length} screens, ${required.length} checks proven in the saved trees`};
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
  // forceAppLaunch restarts the app, so the in-memory cart starts empty even after the smoke run.
  extra:{'appium:appActivity':'.MainActivity','appium:forceAppLaunch':true,'appium:autoGrantPermissions':true,'appium:newCommandTimeout':300,'appium:uiautomator2ServerLaunchTimeout':120000,'appium:uiautomator2ServerInstallTimeout':120000,'appium:adbExecTimeout':120000}
 });
 const result=verifyWalk(contract,core,report,outDir);
 console.log(`${report.outcome} ${join(outDir,'report.json')}${report.error?` :: ${report.error}`:''}`);
 console.log(`verdict: ${result.reason}`);
 process.exit(result.ok?0:1);
}
