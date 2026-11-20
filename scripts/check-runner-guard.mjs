import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parse} from 'yaml';
import {Evaluator,Lexer,Parser,data} from '@actions/expressions';
import {Binary,ContextAccess,Grouping,IndexAccess,Literal,Logical,Unary} from '@actions/expressions/ast';

export const repository=process.env.GITHUB_REPOSITORY??'wopee-io-demos/tazumo';
export const hosted='ubuntu-latest';
export const unguardedExpression="vars.RUNNER_MODE == 'hosted' && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"linux\",\"x64\",\"demos\"]')";
export const hostedLabels=new Set(['ubuntu-latest','ubuntu-24.04','ubuntu-22.04','ubuntu-24.04-arm','ubuntu-22.04-arm','macos-latest','macos-26','macos-15','macos-14','macos-13','windows-latest','windows-2025','windows-2022','windows-11-arm']);
const isHosted=(label)=>typeof label==='string'&&hostedLabels.has(label);

const pr=(headRepo)=>({event_name:'pull_request',repository,event:{pull_request:{number:1,head:{repo:headRepo&&{full_name:headRepo}}}}});
export const events={
  'push to main':{trigger:'push',github:{event_name:'push',repository,ref:'refs/heads/main',event:{}}},
  'schedule':{trigger:'schedule',github:{event_name:'schedule',repository,ref:'refs/heads/main',event:{}}},
  'workflow_dispatch':{trigger:'workflow_dispatch',github:{event_name:'workflow_dispatch',repository,ref:'refs/heads/main',event:{}}},
  'same-repo PR':{trigger:'pull_request',github:pr(repository)},
  'fork PR':{trigger:'pull_request',github:pr('someone/tazumo')},
  'PR from deleted fork':{trigger:'pull_request',github:pr(null)}
};
export const modelledTriggers=new Set(Object.values(events).map(e=>e.trigger));
export const modes={'RUNNER_MODE=hosted':{RUNNER_MODE:'hosted'},'RUNNER_MODE unset':{},'RUNNER_MODE=self-hosted':{RUNNER_MODE:'self-hosted'}};
const untrusted=new Set(['fork PR','PR from deleted fork']);
const prEvents=Object.keys(events).filter(e=>events[e].trigger==='pull_request');

const strip=(expression)=>expression.trim().replace(/^\$\{\{\s*|\s*\}\}$/g,'');
export function evaluate(expression,github,vars){
  const lexed=new Lexer(strip(expression)).lex();
  const tree=new Parser(lexed.tokens,['github','vars'],[]).parse();
  const context=JSON.parse(JSON.stringify({github,vars}),data.reviver);
  return JSON.parse(JSON.stringify(new Evaluator(tree,context).evaluate(),data.replacer));
}

export const expected=(event,mode)=>mode==='RUNNER_MODE=hosted'||untrusted.has(event)?'hosted':'self-hosted';
const classify=(runner)=>isHosted(runner)?'hosted'
  :[runner].flat().map(String).includes('self-hosted')?'self-hosted':`unexpected ${JSON.stringify(runner)}`;

export function matrix(expression,triggers=[...modelledTriggers]){
  const rows=[];
  for(const [event,{trigger,github}] of Object.entries(events))for(const [mode,vars] of Object.entries(modes)){
    if(!triggers.includes(trigger))continue;
    rows.push({event,mode,actual:classify(evaluate(expression,github,vars)),expected:expected(event,mode)});
  }
  return rows;
}

const isEventName=(n)=>n instanceof IndexAccess&&n.expr instanceof ContextAccess&&n.expr.name.lexeme==='github'
  &&n.index instanceof Literal&&n.index.literal.value==='event_name';
const onlyEventName=(n)=>n instanceof Literal||isEventName(n)
  ||(n instanceof Binary&&onlyEventName(n.left)&&onlyEventName(n.right))
  ||(n instanceof Logical&&n.args.every(onlyEventName))
  ||(n instanceof Unary&&onlyEventName(n.expr))
  ||(n instanceof Grouping&&onlyEventName(n.group));

function decide(n,context){
  if(n instanceof Grouping)return decide(n.group,context);
  if(n instanceof Unary&&n.operator.lexeme==='!'){const v=decide(n.expr,context);return v===undefined?undefined:!v;}
  if(n instanceof Logical){
    const values=n.args.map(a=>decide(a,context));
    if(n.operator.lexeme==='&&')return values.includes(false)?false:values.includes(undefined)?undefined:true;
    return values.includes(true)?true:values.includes(undefined)?undefined:false;
  }
  if(onlyEventName(n))return Boolean(JSON.parse(JSON.stringify(new Evaluator(n,context).evaluate(),data.replacer)));
  return undefined;
}

function runsOnPullRequests(job){
  if(job.if===undefined)return true;
  try{
    const tree=new Parser(new Lexer(strip(String(job.if))).lex().tokens,['github','vars','env','inputs','needs','matrix','steps','job','runner','strategy','secrets'],[]).parse();
    return prEvents.some(e=>decide(tree,JSON.parse(JSON.stringify({github:events[e].github}),data.reviver))!==false);
  }catch{return true;}
}

const expressions=(value)=>[...JSON.stringify(value).matchAll(/\$\{\{(.*?)\}\}/g)].map(m=>m[1]);

export function workflowJobs(dir=new URL('../.github/workflows/',import.meta.url)){
  const jobs=[];
  for(const file of readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)).sort()){
    const workflow=parse(readFileSync(new URL(file,dir),'utf8'));
    const on=workflow.on??workflow[true];
    const triggers=typeof on==='string'?[on]:Array.isArray(on)?on:Object.keys(on??{});
    for(const [id,job] of Object.entries(workflow.jobs??{})){
      const scopes=[workflow.permissions,job.permissions];
      jobs.push({
        file,id,triggers,job,runsOn:job['runs-on'],
        secrets:job.secrets!==undefined||expressions({env:workflow.env,job}).some(x=>/\bsecrets\b(?!\s*\.\s*GITHUB_TOKEN\b)/.test(x)),
        writes:scopes.some(p=>p==='write-all'||(p&&typeof p==='object'&&Object.values(p).includes('write')))
      });
    }
  }
  return jobs;
}

export function check(dir){
  const failures=[],report=[];
  const jobs=workflowJobs(dir);
  if(jobs.length===0)failures.push('No workflow jobs found');
  for(const j of jobs){
    const name=`${j.file}#${j.id}`;
    const onPr=j.triggers.includes('pull_request')&&runsOnPullRequests(j.job);
    if(j.triggers.includes('pull_request_target'))failures.push(`${name}: pull_request_target is not allowed`);
    if(j.job.uses)failures.push(`${name}: reusable workflow jobs are not modelled; inline the job or extend the guard`);
    if(onPr&&j.secrets)failures.push(`${name}: runs on pull_request and references secrets other than GITHUB_TOKEN`);
    if(onPr&&j.writes)failures.push(`${name}: runs on pull_request with write permissions`);
    const runsOn=j.runsOn;
    if(typeof runsOn==='string'&&runsOn.includes('${{')){
      const unmodelled=j.triggers.filter(t=>!modelledTriggers.has(t));
      if(unmodelled.length)failures.push(`${name}: expression runs-on with unmodelled triggers ${unmodelled.join(', ')}`);
      const rows=matrix(runsOn,j.triggers);
      for(const r of rows)if(r.actual!==r.expected)failures.push(`${name}: ${r.event}, ${r.mode} -> ${r.actual}, expected ${r.expected}`);
      report.push({name,triggers:j.triggers,rows});
    }else if(isHosted(runsOn)){
      report.push({name,triggers:j.triggers,static:runsOn});
    }else if(!j.job.uses){
      failures.push(`${name}: runs-on ${JSON.stringify(runsOn)} is not a GitHub-hosted label or a guarded expression`);
    }
  }
  return {failures,report,jobs:jobs.length};
}

const entry=process.argv[1]&&pathToFileURL(realpathSync(process.argv[1])).href;
if(import.meta.url===entry){
  const control=matrix(unguardedExpression).filter(r=>r.actual!==r.expected);
  if(!control.some(r=>r.event==='fork PR'&&r.mode==='RUNNER_MODE unset'&&r.actual==='self-hosted')){
    console.error('Control failed: the unguarded expression should route an unset-mode fork PR to self-hosted');
    process.exit(1);
  }
  const dir=process.argv[2]?pathToFileURL(realpathSync(process.argv[2])+'/'):undefined;
  const {failures,report,jobs}=check(dir);
  for(const job of report){
    if(job.static){console.log(`${job.name} [${job.triggers.join(', ')}]: static ${job.static}`);continue;}
    console.log(`${job.name} [${job.triggers.join(', ')}]`);
    for(const r of job.rows)console.log(`  ${r.event.padEnd(20)} ${r.mode.padEnd(23)} -> ${r.actual}${r.actual===r.expected?'':'  FAIL'}`);
  }
  console.log(`Control: the previous unguarded expression fails ${control.length} cases, including an unset-mode fork PR on self-hosted.`);
  if(failures.length){console.error(failures.join('\n'));process.exit(1);}
  console.log(`Runner guard verified for ${jobs} jobs: no workflow in this repository routes a fork pull request to the self-hosted pool, and pull_request jobs use no secrets or write permissions.`);
}
