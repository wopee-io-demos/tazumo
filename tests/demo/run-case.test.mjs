import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {find,center,matches,validate,perform,run,textOnScreen} from './run-case.mjs';

const rect=(x,y,width=40,height=40)=>({x,y,width,height});
const screen={width:400,height:800};
const app='io.wopee.demos.tazumo';
const casePath=new URL('./flow-search-add-cart.json',import.meta.url);
const demoCase=JSON.parse(readFileSync(casePath,'utf8'));

function fake(trees){
 const calls=[];
 let i=0;
 const call=(args,positionals=[])=>{
  calls.push([...args,...positionals].join(' '));
  if(args[0]==='dump')return trees[Math.min(i++,trees.length-1)];
  if(args.join(' ')==='io keyboard status')return {visible:true};
  if(args.join(' ')==='device info')return {device:{screenSize:screen}};
  return {};
 };
 return {call,calls};
}

test('matches follows mobile-agent: accessibility id is the label, id is the identifier',()=>{
 assert.equal(matches({label:'Cart, 1'},'accessibility id','Cart, 1',app),true);
 assert.equal(matches({text:'Cart, 1'},'accessibility id','Cart, 1',app),false);
 assert.equal(matches({identifier:`${app}:id/sut-search`},'id','sut-search',app),true);
 assert.equal(matches({label:'sut-search'},'id','sut-search',app),false);
 assert.equal(matches({type:'android.widget.EditText'},'class name','android.widget.EditText',app),true);
});

test('find drops zero-sized and off-screen controls, but absent also sees off-screen ones',()=>{
 const tree={elements:[{label:'Add Seasonal veggie bowl',rect:rect(20,900)},{label:'Add Seasonal veggie bowl',rect:rect(20,20,0,0)}]};
 assert.equal(find(tree,{action:'see',by:'accessibility id',value:'Add Seasonal veggie bowl'},{screen}).length,0);
 assert.equal(find(tree,{action:'absent',by:'accessibility id',value:'Add Seasonal veggie bowl'},{screen}).length,1);
});

test('validate rejects unknown actions, unsupported locators and a final touch',()=>{
 const ok={app,steps:[{action:'see',by:'accessibility id',value:'x'}]};
 assert.doesNotThrow(()=>validate(ok));
 assert.throws(()=>validate({app,steps:[{action:'sea',by:'accessibility id',value:'x'}]}),/Unsupported action/);
 assert.throws(()=>validate({app,steps:[{action:'see',by:'xpath',value:'//x'}]}),/Unsupported locator/);
 assert.throws(()=>validate({app,steps:[{action:'tap',by:'accessibility id',value:'x'}]}),/observable assertion/);
 assert.throws(()=>validate({app,steps:[{action:'type',by:'accessibility id',value:'x'},{action:'see',by:'accessibility id',value:'x'}]}),/requires text/);
});

test('perform taps only after the frame holds still across two dumps',async()=>{
 const step={action:'tap',by:'accessibility id',value:'Cart, 1'};
 const {call,calls}=fake([{elements:[{label:'Cart, 1',rect:rect(300,10)}]},{elements:[{label:'Cart, 1',rect:rect(300,20)}]},{elements:[{label:'Cart, 1',rect:rect(300,20)}]}]);
 await perform(step,call,{screen,poll:1});
 assert.deepEqual(calls,['dump ui','dump ui','dump ui','io tap 320,40']);
});

test('perform types, then hides the keyboard',async()=>{
 const field={label:'What are you looking for?',rect:rect(20,300,300,40)};
 const {call,calls}=fake([{elements:[field]}]);
 await perform({action:'type',by:'accessibility id',value:field.label,text:'Margherita'},call,{screen,poll:1});
 assert.deepEqual(calls.slice(-4),['io tap 170,320','io fill Margherita','io keyboard status','io keyboard hide']);
});

test('perform fails on a missing element, an ambiguous locator and an element that stays present',async()=>{
 const two={elements:[{label:'Remove one Margherita pizza',rect:rect(20,100)},{label:'Remove one Margherita pizza',rect:rect(20,200)}]};
 await assert.rejects(perform({action:'see',by:'accessibility id',value:'Cart, 1'},fake([{elements:[]}]).call,{screen,timeout:20,poll:1}),/Expected see: Cart, 1/);
 await assert.rejects(perform({action:'see',by:'accessibility id',value:'Remove one Margherita pizza'},fake([two]).call,{screen,timeout:20,poll:1}),/Ambiguous locator/);
 await assert.rejects(perform({action:'absent',by:'accessibility id',value:'Remove one Margherita pizza'},fake([two]).call,{screen,timeout:20,poll:1}),/Expected absent/);
});

test('run fails when a final text is missing and still writes the report and UI dump',async()=>{
 const out=mkdtempSync(join(tmpdir(),'a7-run-'));
 const tree={elements:[{label:'Done',rect:rect(10,10)},{text:'Subtotal €11.90',rect:rect(10,100,200,20)}]};
 const spec={app,steps:[{action:'see',by:'accessibility id',value:'Done'}]};
 const missing=await run({spec,call:fake([tree]).call,out,pace:0,expectText:['Subtotal €11.90','Margherita pizza × 1']});
 assert.equal(missing.outcome,'failed');
 assert.match(missing.error,/missing: Margherita pizza × 1$/);
 assert.equal(JSON.parse(readFileSync(join(out,'report.json'),'utf8')).outcome,'failed');
 assert.ok(textOnScreen(JSON.parse(readFileSync(join(out,'ui.json'),'utf8')),'Subtotal €11.90',screen));
 const passed=await run({spec,call:fake([tree]).call,out,pace:0,expectText:['Subtotal €11.90']});
 assert.equal(passed.outcome,'passed');
});

test('the CLI exits non-zero when mobilecli fails and refuses the iOS half',()=>{
 const dir=mkdtempSync(join(tmpdir(),'a7-cli-'));
 const bin=join(dir,'mobilecli');
 writeFileSync(bin,'#!/bin/sh\necho \'{"status":"error","data":{"message":"no device"}}\'\nexit 1\n');
 chmodSync(bin,0o755);
 const script=new URL('./run-case.mjs',import.meta.url).pathname;
 const env={...process.env,MOBILECLI_BIN:bin,MOBILECLI_DEVICE:'emulator-5554',DEMO_PACE_MS:'0'};
 const failed=spawnSync(process.execPath,[script,casePath.pathname,'android',join(dir,'out')],{env,encoding:'utf8'});
 assert.equal(failed.status,1);
 const report=JSON.parse(readFileSync(join(dir,'out','report.json'),'utf8'));
 assert.equal(report.outcome,'failed');
 assert.match(report.error,/no device/);
 assert.equal(spawnSync(process.execPath,[script,casePath.pathname,'ios',join(dir,'ios')],{env}).status,2);
});

test('the demo case targets the same flow on iOS and Android and ends on the cart',()=>{
 const flow=p=>demoCase.platforms[p].steps.filter(s=>s.value!=='Return');
 assert.deepEqual(flow('ios'),flow('android'));
 assert.doesNotThrow(()=>validate(demoCase.platforms.android));
 for(const p of ['ios','android']){
  const steps=demoCase.platforms[p].steps;
  assert.equal(demoCase.platforms[p].app,app);
  assert.ok(steps.some(s=>s.action==='type'&&s.text==='Margherita'));
  assert.deepEqual(steps.at(-1),{action:'see',by:'accessibility id',value:'Remove one Margherita pizza'});
 }
});

test('center returns integer tap coordinates',()=>{
 assert.equal(center({rect:{x:331,y:628,width:38,height:38}}),'350,647');
});
