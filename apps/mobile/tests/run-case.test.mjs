import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,readdirSync,mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execute,validate} from './run-case.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const load=f=>JSON.parse(readFileSync(join(here,f),'utf8'));
const smoke=load('android-smoke.case.json'),negative=load('android-smoke.negative.case.json');
const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
const tmp=()=>mkdtempSync(join(tmpdir(),'tazumo-case-'));

// In-memory Appium: `screen` maps "by=value" to element count; `onClick` mutates it.
function fakeDevice(screen,{onClick=()=>{},fail}={}){
 const log=[];
 const call=async(method,path,body)=>{
  log.push(`${method} ${path}${body?.text?` ${body.text}`:''}`);
  if(fail?.(method,path))throw new Error('Appium HTTP 500: instrumentation crashed');
  if(path==='/status')return {ready:true};
  if(method==='POST'&&path==='/session')return {sessionId:'s1'};
  if(path.endsWith('/elements')){const key=`${body.using}=${body.value}`;return Array.from({length:screen.get(key)??0},(_,i)=>({[ELEMENT]:`${key}#${i}`}))}
  if(path.endsWith('/displayed'))return true;
  if(path.endsWith('/click'))onClick(decodeURIComponent(path.split('/element/')[1].replace('/click','')).split('#')[0],screen);
  if(path.endsWith('/screenshot'))return Buffer.from('png').toString('base64');
  if(path.endsWith('/source'))return '<hierarchy/>';
  return null;
 };
 return {call,log};
}
const allPresent=testCase=>new Map(testCase.platforms.android.steps.map(s=>[`${s.by}=${s.value}`,1]));

test('the shipped cases are valid mobile-agent cases',()=>{
 assert.equal(validate(smoke).steps.at(-1).action,'see');
 assert.equal(validate(negative).steps.length,2);
 assert.throws(()=>validate({id:'x',intent:'y',platforms:{android:{app:'a',steps:[{action:'tap',by:'id',value:'b'}]}}}),/observable assertion/);
});

test('smoke case passes, clicks each tap target once and captures every step',async()=>{
 const {call,log}=fakeDevice(allPresent(smoke)),out=tmp();
 const report=await execute(smoke,call,out,{timeout:50,settings:{disableIdLocatorAutocompletion:true}});
 assert.ok(log.indexOf('POST /session/s1/appium/settings')>0&&log.indexOf('POST /session/s1/appium/settings')<log.findIndex(l=>l.endsWith('/elements')),'settings applied before the first lookup');
 assert.equal(report.outcome,'passed',report.error);
 assert.equal(report.steps.length,smoke.platforms.android.steps.length);
 assert.deepEqual(log.filter(l=>l.endsWith('/click')).map(l=>l.split('/element/')[1].split('%23')[0]),['id%3Dsut-open-product-pizza','id%3Dsut-detail-add','id%3Dsut-nav-cart']);
 assert.ok(existsSync(join(out,'01-see.png'))&&existsSync(join(out,'final.xml')));
 assert.ok(log.includes('DELETE /session/s1'));
});

test('a missing element is an expectation failure on that step',async()=>{
 const {call}=fakeDevice(new Map([['id=sut-open-product-pizza',1]]));
 const report=await execute(negative,call,tmp(),{timeout:50});
 assert.equal(report.outcome,'failed');
 assert.equal(report.currentStep,2);
 assert.match(report.error,/Expected see: sut-does-not-exist/);
});

test('ambiguous locators fail and infrastructure errors are not expectation failures',async()=>{
 const ambiguous=await execute(negative,fakeDevice(new Map([['id=sut-open-product-pizza',2]])).call,tmp(),{timeout:50});
 assert.equal(ambiguous.outcome,'failed');
 assert.match(ambiguous.error,/Ambiguous/);
 const crash=await execute(negative,fakeDevice(allPresent(negative),{fail:(m,p)=>p.endsWith('/elements')}).call,tmp(),{timeout:50});
 assert.equal(crash.outcome,'infrastructure-failed');
});

test('absent waits for a disappearing element and type clears then sends text',async()=>{
 const testCase={id:'t',intent:'i',platforms:{android:{app:'a',steps:[
  {action:'type',by:'id',value:'sut-search',text:'Piazza'},
  {action:'tap',by:'id',value:'sut-close'},
  {action:'absent',by:'id',value:'sut-sheet'}]}}};
 const screen=new Map([['id=sut-search',1],['id=sut-close',1],['id=sut-sheet',1]]);
 const {call,log}=fakeDevice(screen,{onClick:()=>setTimeout(()=>screen.delete('id=sut-sheet'),400)});
 const report=await execute(testCase,call,tmp(),{timeout:2000});
 assert.equal(report.outcome,'passed',report.error);
 assert.ok(log.some(l=>l.endsWith('/clear'))&&log.some(l=>l.endsWith('/value Piazza')));
});

test('CLI --expect-fail accepts only an expectation failure on the last step',async()=>{
 const visible=new Set(['sut-open-product-pizza']);
 const server=createServer((req,res)=>{
  let body='';
  req.on('data',c=>body+=c);
  req.on('end',()=>{
   const send=v=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({value:v}))};
   if(req.url==='/status')return send({ready:true});
   if(req.url==='/session')return send({sessionId:'s1'});
   if(req.url.endsWith('/elements')){const {value}=JSON.parse(body);return send(visible.has(value)?[{[ELEMENT]:value}]:[])}
   if(req.url.endsWith('/displayed'))return send(true);
   if(req.url.endsWith('/screenshot'))return send('cG5n');
   if(req.url.endsWith('/source'))return send('<hierarchy/>');
   send(null);
  });
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const run=(file,...flags)=>new Promise(r=>{
  const child=spawn(process.execPath,[join(here,'run-case.mjs'),join(here,file),tmp(),...flags],{env:{...process.env,APPIUM_URL:`http://127.0.0.1:${server.address().port}`,STEP_TIMEOUT_MS:'300',FIRST_STEP_TIMEOUT_MS:'300'}});
  child.on('close',r);
 });
 try{
  assert.equal(await run('android-smoke.negative.case.json'),1);
  assert.equal(await run('android-smoke.negative.case.json','--expect-fail'),0);
  assert.equal(await run('android-smoke.case.json','--expect-fail'),1,'failing before the last step is not the expected negative result');
 }finally{server.close()}
});

test('every sut- identifier in the cases exists in the app source',()=>{
 const src=join(here,'..','src');
 const source=['App.tsx',...readdirSync(join(src,'screens')).map(f=>join('screens',f))].map(f=>readFileSync(join(src,f),'utf8')).join('\n');
 const ids=smoke.platforms.android.steps.flatMap(s=>s.value.match(/sut-[a-z0-9-]+/g)??[]);
 assert.ok(ids.length>=8);
 for(const id of ids)assert.ok(source.includes(id)||source.includes(id.replace(/-pizza$/,'-${p.id}')),`missing ${id}`);
});
