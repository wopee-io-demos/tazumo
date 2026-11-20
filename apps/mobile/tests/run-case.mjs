#!/usr/bin/env node
// Runs one mobile-agent case (tap/type/see/absent) against a local Appium server via the W3C WebDriver API.
// Usage: node run-case.mjs <case.json> <outDir> [--expect-fail]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

const args=process.argv.slice(2);
const [casePath,outDir]=args.filter(a=>!a.startsWith('--'));
const expectFail=args.includes('--expect-fail');
const platform='android';
const server=process.env.APPIUM_URL??'http://127.0.0.1:4723';
const stepTimeout=Number(process.env.STEP_TIMEOUT_MS??30000);
const firstStepTimeout=Number(process.env.FIRST_STEP_TIMEOUT_MS??90000);
if(!casePath||!outDir){console.error('usage: run-case.mjs <case.json> <outDir> [--expect-fail]');process.exit(2)}

const testCase=JSON.parse(readFileSync(casePath,'utf8'));
const target=testCase.platforms?.[platform];
if(!target?.app||!Array.isArray(target.steps)||target.steps.length===0)throw new Error(`case ${testCase.id} has no ${platform} steps`);
mkdirSync(outDir,{recursive:true});

const W3C_ELEMENT='element-6066-11e4-a52f-4ce19ad4dfda';
async function call(method,path,body){
 const res=await fetch(server+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(new Error(json.value?.message??`${method} ${path} -> ${res.status}`),{status:res.status,error:json.value?.error});
 return json.value;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const capabilities={
 platformName:'Android',
 'appium:automationName':'UiAutomator2',
 'appium:appPackage':target.app,
 'appium:appActivity':process.env.APP_ACTIVITY??'.MainActivity',
 'appium:noReset':true,
 'appium:forceAppLaunch':true,
 'appium:autoGrantPermissions':true,
 'appium:newCommandTimeout':300,
 'appium:uiautomator2ServerLaunchTimeout':120000,
 'appium:uiautomator2ServerInstallTimeout':120000,
 'appium:adbExecTimeout':120000
};

let session;
const sid=()=>`/session/${session}`;

function locators(step){
 if(step.by==='id')return [['id',step.value],['xpath',`//*[@resource-id="${step.value}"]`]];
 return [[step.by,step.value]];
}

async function findOnce(step){
 for(const [using,value] of locators(step)){
  try{const el=await call('POST',`${sid()}/element`,{using,value});return {id:el[W3C_ELEMENT]??el.ELEMENT,matchedBy:using}}
  catch(e){if(e.error!=='no such element')throw e}
 }
 return null;
}

async function find(step,timeout){
 const end=Date.now()+timeout;
 while(true){
  const found=await findOnce(step);
  if(found&&await call('GET',`${sid()}/element/${found.id}/displayed`))return found;
  if(Date.now()>end)return null;
  await sleep(500);
 }
}

async function capture(name){
 try{
  writeFileSync(join(outDir,`${name}.png`),Buffer.from(await call('GET',`${sid()}/screenshot`),'base64'));
  writeFileSync(join(outDir,`${name}.xml`),await call('GET',`${sid()}/source`));
 }catch(e){console.error(`capture ${name} failed: ${e.message}`)}
}

const report={case:testCase.id,intent:testCase.intent,platform,app:target.app,expectFail,startedAt:new Date().toISOString(),steps:[],status:'failed'};
let failure;
try{
 session=(await call('POST','/session',{capabilities:{alwaysMatch:capabilities,firstMatch:[{}]}})).sessionId;
 for(const [i,step] of target.steps.entries()){
  const started=Date.now(),entry={index:i+1,...step,status:'failed'};
  report.steps.push(entry);
  const label=`${String(i+1).padStart(2,'0')}-${step.action}`;
  try{
   const timeout=i===0?firstStepTimeout:stepTimeout;
   if(step.action==='absent'){
    if(await find(step,Math.min(timeout,5000)))throw new Error(`expected absent: ${step.by}=${step.value}`);
   }else{
    const el=await find(step,timeout);
    if(!el)throw new Error(`not found within ${timeout} ms: ${step.by}=${step.value}`);
    entry.matchedBy=el.matchedBy;
    if(step.action==='tap')await call('POST',`${sid()}/element/${el.id}/click`,{});
    else if(step.action==='type')await call('POST',`${sid()}/element/${el.id}/value`,{text:String(step.text??'')});
    else if(step.action!=='see')throw new Error(`unknown action ${step.action}`);
    if(step.action!=='see')await sleep(700);
   }
   entry.status='passed';
  }catch(e){entry.error=e.message;throw e}
  finally{entry.ms=Date.now()-started;await capture(entry.status==='passed'?label:`${label}-failed`)}
 }
 report.status='passed';
}catch(e){failure=e;report.error=e.message}
finally{
 if(session)await call('DELETE',sid()).catch(()=>{});
 report.finishedAt=new Date().toISOString();
 writeFileSync(join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n');
}

for(const s of report.steps)console.log(`${s.status==='passed'?'PASS':'FAIL'} ${s.index} ${s.action} ${s.by}=${s.value}${s.matchedBy?` (matched by ${s.matchedBy})`:''}${s.error?` :: ${s.error}`:''}`);
console.log(`case ${testCase.id}: ${report.status}${expectFail?' (expected to fail)':''}`);
if(expectFail){
 const steps=report.steps,expected=steps.length===target.steps.length&&steps.at(-1).status==='failed'&&steps.slice(0,-1).every(s=>s.status==='passed');
 console.log(expected?'negative check: failed on the last step as expected':'negative check: did not fail as expected');
 process.exit(expected?0:1);
}
process.exit(failure?1:0);
