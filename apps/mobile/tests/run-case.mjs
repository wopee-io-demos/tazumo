#!/usr/bin/env node
// Android executor for the mobile-agent case format over Appium's W3C WebDriver API.
// Mirrors mobile-agent skills/wopee-mobile-run/scripts/native.py (validation, step semantics, report.json shape) and
// additionally saves a screenshot and UI tree after every step.
// Usage: node run-case.mjs <case.json> <outDir> [--expect-fail]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
const STRATEGIES=new Set(['id','accessibility id','class name','xpath']);
const ACTIONS=new Set(['tap','type','see','absent','dismiss']);

export class ExpectationError extends Error {}

export function validate(testCase,platform='android'){
 const spec=testCase.platforms?.[platform];
 if(!spec)throw new Error(`No ${platform} platform in case`);
 for(const value of [testCase.id,testCase.intent,spec.app])if(typeof value!=='string'||!value.trim())throw new Error('Case id, intent and app must be non-empty strings');
 const steps=spec.steps;
 if(!Array.isArray(steps)||steps.length===0||!['see','absent'].includes(steps.at(-1).action))throw new Error('End the case with an observable assertion');
 for(const step of steps){
  if(!ACTIONS.has(step.action))throw new Error(`Unsupported action: ${step.action}`);
  if(!STRATEGIES.has(step.by)||!step.value)throw new Error('Expected a locator strategy and non-empty value');
  if(step.action==='type'&&typeof step.text!=='string')throw new Error('Typing requires text');
 }
 return spec;
}

export function client(server){
 return async function call(method,path,body){
  const res=await fetch(server.replace(/\/$/,'')+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const text=await res.text();
  if(!res.ok){
   if(text.includes('stale element reference')&&method==='GET'&&path.endsWith('/displayed'))return false;
   throw new Error(`Appium HTTP ${res.status}: ${text.slice(0,600)}`);
  }
  return JSON.parse(text).value;
 };
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function perform(step,call,timeout){
 const end=Date.now()+timeout;
 while(true){
  const matches=await call('POST','/elements',{using:step.by,value:step.value});
  const visible=[];
  for(const match of matches){
   const element='/element/'+encodeURIComponent(match[ELEMENT]);
   if(await call('GET',element+'/displayed'))visible.push(element);
  }
  if(step.action==='absent'&&visible.length===0)return;
  if(step.action!=='absent'&&visible.length>0){
   if(visible.length!==1)throw new ExpectationError(`Ambiguous locator: ${step.value}`);
   if(step.action==='tap'||step.action==='dismiss')await call('POST',visible[0]+'/click',{});
   else if(step.action==='type'){await call('POST',visible[0]+'/clear',{});await call('POST',visible[0]+'/value',{text:step.text})}
   return;
  }
  if(step.action==='dismiss')return;
  if(Date.now()>=end)throw new ExpectationError(`Expected ${step.action}: ${step.value}`);
  await sleep(350);
 }
}

export async function execute(testCase,call,folder,{timeout=15000,firstTimeout=timeout,extra={},settings}={}){
 const spec=validate(testCase);
 const report={case:testCase.id,platform:'android',app:spec.app,wopee:testCase.wopee??null,steps:[],outcome:'infrastructure-failed'};
 mkdirSync(folder,{recursive:true});
 let session;
 const capture=async name=>{
  for(const [path,file,write] of [['/source',`${name}.xml`,v=>v],['/screenshot',`${name}.png`,v=>Buffer.from(v,'base64')]]){
   try{writeFileSync(join(folder,file),write(await call('GET',session+path)))}
   catch(e){(report.evidenceErrors??=[]).push(e.message)}
  }
 };
 try{
  if(!(await call('GET','/status'))?.ready)throw new Error('Appium server is not ready');
  const caps={...extra,platformName:'android','appium:automationName':'UiAutomator2','appium:noReset':true,'appium:appPackage':spec.app};
  session='/session/'+(await call('POST','/session',{capabilities:{alwaysMatch:caps}})).sessionId;
  const device=(method,path,body)=>call(method,session+path,body);
  if(settings)await device('POST','/appium/settings',{settings});
  for(const [i,step] of spec.steps.entries()){
   report.currentStep=i+1;
   await perform(step,device,i===0?firstTimeout:timeout);
   report.steps.push({index:i+1,action:step.action,outcome:'completed'});
   await capture(`${String(i+1).padStart(2,'0')}-${step.action}`);
  }
  report.outcome='passed';
 }catch(e){
  if(e instanceof ExpectationError)report.outcome='failed';
  report.error=e.message;
 }finally{
  if(session){
   await capture('final');
   try{await call('DELETE',session)}catch(e){report.cleanupError=e.message}
   if(report.outcome==='passed'&&(report.evidenceErrors||report.cleanupError))report.outcome='infrastructure-failed';
  }
  writeFileSync(join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}

if(import.meta.url===`file://${process.argv[1]}`){
 const args=process.argv.slice(2),[casePath,outDir]=args.filter(a=>!a.startsWith('--')),expectFail=args.includes('--expect-fail');
 if(!casePath||!outDir){console.error('usage: run-case.mjs <case.json> <outDir> [--expect-fail]');process.exit(2)}
 const testCase=JSON.parse(readFileSync(casePath,'utf8'));
 const report=await execute(testCase,client(process.env.APPIUM_URL??'http://127.0.0.1:4723'),outDir,{
  timeout:Number(process.env.STEP_TIMEOUT_MS??15000),
  firstTimeout:Number(process.env.FIRST_STEP_TIMEOUT_MS??90000),
  // React Native emits testID as a bare resource-id; stop UiAutomator2 rewriting `id` locators to `<package>:id/<value>`.
  settings:{disableIdLocatorAutocompletion:true},
  extra:{'appium:appActivity':'.MainActivity','appium:forceAppLaunch':true,'appium:autoGrantPermissions':true,'appium:newCommandTimeout':300,'appium:uiautomator2ServerLaunchTimeout':120000,'appium:uiautomator2ServerInstallTimeout':120000,'appium:adbExecTimeout':120000}
 });
 console.log(`${report.outcome} ${join(outDir,'report.json')}${report.error?` :: ${report.error}`:''}`);
 if(expectFail){
  const steps=testCase.platforms.android.steps.length;
  const ok=report.outcome==='failed'&&report.currentStep===steps&&report.steps.length===steps-1;
  console.log(ok?'negative check: expectation failed on the last step as required':'negative check: did not fail as required');
  process.exit(ok?0:1);
 }
 process.exit(report.outcome==='passed'?0:1);
}
