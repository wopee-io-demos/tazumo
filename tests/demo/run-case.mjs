// Runs the Android half of a mobile-agent case (tests/demo/*.json) through the mobilecli CLI, at a human pace.
// Locator semantics follow mobile-agent's skills/wopee-mobile-run/scripts/mobilecli.py; iOS runs use that runner.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ACTIONS=new Set(['tap','type','see','absent']);
export const STRATEGIES=new Set(['id','accessibility id','class name']);

export function validate(spec){
 if(!spec?.app||!Array.isArray(spec.steps)||spec.steps.length===0)throw new Error('The case needs an app and steps for android');
 for(const step of spec.steps){
  if(!ACTIONS.has(step.action))throw new Error(`Unsupported action: ${step.action}`);
  if(!STRATEGIES.has(step.by)||!step.value)throw new Error(`Unsupported locator: ${step.by}`);
  if(step.action==='type'&&typeof step.text!=='string')throw new Error('Typing requires text');
 }
 if(!['see','absent'].includes(spec.steps.at(-1).action))throw new Error('End the case with an observable assertion');
 return spec;
}

export function flatten(elements){
 const out=[];
 const walk=list=>{for(const e of list??[]){out.push(e);walk(e.children);}};
 walk(elements);
 return out;
}

export function matches(element,by,value,app){
 const identifier=element.identifier??'';
 if(by==='class name')return element.type===value;
 if(by==='id')return identifier===value||(!value.includes(':id/')&&Boolean(app)&&identifier===`${app}:id/${value}`);
 return element.label===value;
}

export function sized(element){
 const r=element.rect??{};
 return r.width>0&&r.height>0;
}

export function onScreen(element,screen){
 if(!sized(element))return false;
 if(!screen)return true;
 const r=element.rect,x=r.x+r.width/2,y=r.y+r.height/2;
 return x>=0&&x<screen.width&&y>=0&&y<screen.height;
}

export function find(tree,step,{screen,app}={}){
 const shown=step.action==='absent'?sized:e=>onScreen(e,screen);
 return flatten(tree?.elements).filter(e=>shown(e)&&matches(e,step.by,step.value,app));
}

export function textOnScreen(tree,text,screen){
 return flatten(tree?.elements).some(e=>onScreen(e,screen)&&[e.label,e.text,e.value,e.name].includes(text));
}

export function center(element){
 const r=element.rect;
 return `${Math.round(r.x+r.width/2)},${Math.round(r.y+r.height/2)}`;
}

export function cli(bin,device){
 return (args,positionals=[])=>{
  const argv=[...args,'--device',device,...(positionals.length?['--',...positionals]:[])];
  let raw;
  try{raw=execFileSync(bin,argv,{encoding:'utf8',timeout:60000});}
  catch(error){throw new Error(`mobilecli ${args.join(' ')} failed: ${String(error.stdout||error.stderr||error.message).slice(0,600)}`);}
  const payload=JSON.parse(raw);
  if(payload.status!=='ok')throw new Error(`mobilecli ${args.join(' ')} failed: ${raw.slice(0,600)}`);
  return payload.data;
 };
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function perform(step,call,{screen,app,timeout=20000,poll=400,keyboardWait=4000}={}){
 const end=Date.now()+timeout;
 let settled=null;
 for(;;){
  const found=find(call(['dump','ui']),step,{screen,app});
  if(step.action==='absent'&&found.length===0)return;
  if(step.action!=='absent'&&found.length>1)throw new Error(`Ambiguous locator: ${step.value}`);
  if(step.action!=='absent'&&found.length===1){
   if(step.action==='see')return;
   const rect=JSON.stringify(found[0].rect);
   // A dump does not wait for animations: touch only a control whose frame held still between two dumps.
   if(rect===settled){
    call(['io','tap'],[center(found[0])]);
    if(step.action==='type'){
     call(['io','fill'],[step.text]);
     // The keyboard can open after the fill returns; hide it once it shows, or it covers the results.
     const shown=Date.now()+keyboardWait;
     for(;;){
      if(call(['io','keyboard','status'])?.visible){call(['io','keyboard','hide']);break;}
      if(Date.now()>=shown)break;
      await sleep(poll);
     }
    }
    return;
   }
   settled=rect;
  }else settled=null;
  if(Date.now()>=end)throw new Error(`Expected ${step.action}: ${step.value}`);
  await sleep(poll);
 }
}

export async function run({spec,call,out,pace=1200,expectText=[],timeout,poll}){
 mkdirSync(out,{recursive:true});
 const report={platform:'android',app:spec.app,steps:[],outcome:'failed'};
 try{
  validate(spec);
  const screen=call(['device','info'])?.device?.screenSize;
  call(['apps','launch'],[spec.app]);
  await sleep(pace);
  for(const [i,step] of spec.steps.entries()){
   report.currentStep=i+1;
   await perform(step,call,{screen,app:spec.app,timeout,poll});
   report.steps.push({index:i+1,action:step.action,value:step.value,outcome:'completed'});
   await sleep(pace);
  }
  const tree=call(['dump','ui']);
  const missing=expectText.filter(text=>!textOnScreen(tree,text,screen));
  if(missing.length)throw new Error(`Final screen is missing: ${missing.join(', ')}`);
  report.outcome='passed';
 }catch(error){
  report.error=String(error?.message??error);
 }finally{
  try{writeFileSync(join(out,'ui.json'),JSON.stringify(call(['dump','ui']),null,2)+'\n');}catch(error){report.evidenceError=String(error?.message??error);}
  writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}

async function main(){
 const [casePath,platform,out]=process.argv.slice(2);
 const device=process.env.MOBILECLI_DEVICE;
 if(!casePath||platform!=='android'||!out||!device){
  console.error('Usage: MOBILECLI_DEVICE=<id> node run-case.mjs <case.json> android <out-dir>\nAndroid only; run the iOS half with mobile-agent mobilecli.py.');
  process.exit(2);
 }
 const report=await run({
  spec:JSON.parse(readFileSync(casePath,'utf8')).platforms?.android,
  call:cli(process.env.MOBILECLI_BIN??'mobilecli',device),
  out,
  pace:Number(process.env.DEMO_PACE_MS??1200),
  expectText:(process.env.DEMO_EXPECT_TEXT??'').split('|').filter(Boolean)
 });
 console.log(report.outcome,report.error??'');
 process.exit(report.outcome==='passed'?0:1);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===realpathSync(process.argv[1]))await main();
