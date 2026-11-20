// Runs one platform of a mobile-agent case (tests/demo/*.json) through the mobilecli CLI, at a human pace.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

export function flatten(elements){
 const out=[];
 const walk=list=>{for(const e of list??[]){out.push(e);walk(e.children);}};
 walk(elements);
 return out;
}

export function names(element){
 return [element.identifier,element.name,element.label,element.text,element.value].filter(x=>typeof x==='string'&&x.length>0);
}

export function visible(element,screen){
 const r=element.rect??{};
 if(!(r.width>0&&r.height>0))return false;
 if(!screen)return true;
 const x=r.x+r.width/2,y=r.y+r.height/2;
 return x>=0&&x<screen.width&&y>=0&&y<screen.height;
}

export function find(tree,by,value,screen){
 const seen=new Set();
 return flatten(tree?.elements).filter(e=>{
  if(!visible(e,screen))return false;
  if(by==='class name'?e.type!==value:!names(e).includes(value))return false;
  const key=JSON.stringify(e.rect);
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}

export function center(element){
 const r=element.rect;
 return `${Math.round(r.x+r.width/2)},${Math.round(r.y+r.height/2)}`;
}

function cli(bin,device){
 return (args,positionals=[])=>{
  const argv=[...args,'--device',device,...(positionals.length?['--',...positionals]:[])];
  const raw=execFileSync(bin,argv,{encoding:'utf8',timeout:60000});
  const payload=JSON.parse(raw);
  if(payload.status!=='ok')throw new Error(`mobilecli ${args.join(' ')} failed: ${raw.slice(0,400)}`);
  return payload.data;
 };
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function perform(step,call,{screen,timeout=20000,poll=400}={}){
 const end=Date.now()+timeout;
 let settled=null;
 for(;;){
  const found=find(call(['dump','ui']),step.by,step.value,screen);
  if(step.action==='absent'&&found.length===0)return;
  if(step.action!=='absent'&&found.length>1)throw new Error(`Ambiguous locator: ${step.value}`);
  if(step.action!=='absent'&&found.length===1){
   const rect=JSON.stringify(found[0].rect);
   if(step.action==='see')return;
   if(rect===settled){
    call(['io','tap'],[center(found[0])]);
    if(step.action==='type'){
     call(['io','fill'],[step.text]);
     if(call(['io','keyboard','status'])?.visible)call(['io','keyboard','hide']);
    }
    return;
   }
   settled=rect;
  }else settled=null;
  if(Date.now()>=end)throw new Error(`Expected ${step.action}: ${step.value}`);
  await sleep(poll);
 }
}

async function main(){
 const [casePath,platform,out]=process.argv.slice(2);
 const device=process.env.MOBILECLI_DEVICE,bin=process.env.MOBILECLI_BIN??'mobilecli';
 const pace=Number(process.env.DEMO_PACE_MS??1200);
 const expectText=(process.env.DEMO_EXPECT_TEXT??'').split('|').filter(Boolean);
 if(!casePath||!platform||!out||!device){console.error('Usage: MOBILECLI_DEVICE=<id> node run-case.mjs <case.json> <platform> <out-dir>');process.exit(2);}
 const spec=JSON.parse(readFileSync(casePath,'utf8')).platforms[platform];
 const call=cli(bin,device);
 mkdirSync(out,{recursive:true});
 const report={case:casePath,platform,app:spec.app,device,steps:[],outcome:'failed'};
 try{
  const screen=call(['device','info'])?.device?.screenSize;
  call(['apps','launch'],[spec.app]);
  await sleep(pace);
  for(const [i,step] of spec.steps.entries()){
   await perform(step,call,{screen});
   report.steps.push({index:i+1,action:step.action,value:step.value,outcome:'completed'});
   await sleep(pace);
  }
  const tree=call(['dump','ui']);
  const missing=expectText.filter(text=>find(tree,'text',text,screen).length===0);
  if(missing.length)throw new Error(`Final screen is missing: ${missing.join(', ')}`);
  report.outcome='passed';
 }catch(error){
  report.error=String(error?.message??error);
 }finally{
  try{writeFileSync(join(out,'ui.json'),JSON.stringify(call(['dump','ui']),null,2)+'\n');}catch(error){report.evidenceError=String(error);}
  writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log(report.outcome,report.error??'');
 process.exit(report.outcome==='passed'?0:1);
}

if(import.meta.url===`file://${process.argv[1]}`)await main();
