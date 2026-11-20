import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,readdirSync,mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=fileURLToPath(new URL('.',import.meta.url));
const runner=join(here,'run-case.mjs');
const smokeCase=join(here,'android-smoke.case.json');
const negativeCase=join(here,'android-smoke.negative.case.json');

function fakeAppium(visible){
 const log=[];
 const server=createServer((req,res)=>{
  let body='';
  req.on('data',c=>body+=c);
  req.on('end',()=>{
   log.push(`${req.method} ${req.url}`);
   const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({value}))};
   if(req.method==='POST'&&req.url==='/session')return send(200,{sessionId:'s1',capabilities:{}});
   if(req.url.endsWith('/element')){const {value}=JSON.parse(body);return visible.has(value)?send(200,{'element-6066-11e4-a52f-4ce19ad4dfda':value}):send(404,{error:'no such element',message:'not found'})}
   if(req.url.endsWith('/displayed'))return send(200,true);
   if(req.url.endsWith('/screenshot'))return send(200,Buffer.from('png').toString('base64'));
   if(req.url.endsWith('/source'))return send(200,'<hierarchy/>');
   send(200,null);
  });
 });
 return new Promise(r=>server.listen(0,'127.0.0.1',()=>r({server,log,url:`http://127.0.0.1:${server.address().port}`})));
}

function run(url,casePath,...flags){
 const out=mkdtempSync(join(tmpdir(),'tazumo-case-'));
 const child=spawn(process.execPath,[runner,casePath,out,...flags],{env:{...process.env,APPIUM_URL:url,STEP_TIMEOUT_MS:'600',FIRST_STEP_TIMEOUT_MS:'600'}});
 let stdout='',stderr='';
 child.stdout.on('data',d=>stdout+=d);
 child.stderr.on('data',d=>stderr+=d);
 return new Promise(r=>child.on('close',status=>r({status,stdout,stderr,out,report:JSON.parse(readFileSync(join(out,'report.json'),'utf8'))})));
}

const caseValues=file=>JSON.parse(readFileSync(file,'utf8')).platforms.android.steps.map(s=>s.value);

test('smoke case passes when every element is present and captures each step',async()=>{
 const values=caseValues(smokeCase),{server,log,url}=await fakeAppium(new Set(values));
 try{
  const r=await run(url,smokeCase);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.equal(r.report.status,'passed');
  assert.equal(r.report.steps.length,values.length);
  assert.ok(existsSync(join(r.out,'01-see.png'))&&existsSync(join(r.out,'01-see.xml')));
  assert.ok(log.some(l=>l.startsWith('DELETE /session/s1')));
 }finally{server.close()}
});

test('a missing element fails the case, and --expect-fail accepts only that failure',async()=>{
 const {server,url}=await fakeAppium(new Set(['sut-open-product-pizza']));
 try{
  const failed=await run(url,negativeCase);
  assert.equal(failed.status,1);
  assert.equal(failed.report.steps.at(-1).status,'failed');
  assert.equal((await run(url,negativeCase,'--expect-fail')).status,0);
  assert.equal((await run(url,smokeCase,'--expect-fail')).status,1,'failing on an early step is not the expected negative result');
 }finally{server.close()}
});

test('every sut- identifier in the cases exists in the app source',()=>{
 const src=join(here,'..','src');
 const source=['App.tsx',...readdirSync(join(src,'screens')).map(f=>join('screens',f))].map(f=>readFileSync(join(src,f),'utf8')).join('\n');
 const ids=caseValues(smokeCase).flatMap(v=>v.match(/sut-[a-z0-9-]+/g)??[]);
 assert.ok(ids.length>=8);
 for(const id of ids){
  const literal=source.includes(id);
  const templated=/-pizza$/.test(id)&&source.includes(id.replace(/pizza$/,'${p.id}'));
  assert.ok(literal||templated,`missing ${id}`);
 }
});
