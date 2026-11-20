import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parse} from 'yaml';
import {Evaluator,Lexer,Parser,data} from '@actions/expressions';

export const repository=process.env.GITHUB_REPOSITORY??'wopee-io-demos/tazumo';
export const hosted='ubuntu-latest';
export const unguardedExpression="vars.RUNNER_MODE == 'hosted' && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"linux\",\"x64\",\"demos\"]')";
const hostedLabel=/^(ubuntu|windows|macos)-[\w.-]+$/;

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
const classify=(runner)=>typeof runner==='string'&&hostedLabel.test(runner)?'hosted'
  :[runner].flat().map(String).includes('self-hosted')?'self-hosted':`unexpected ${JSON.stringify(runner)}`;

export function matrix(expression,triggers=[...modelledTriggers]){
  const rows=[];
  for(const [event,{trigger,github}] of Object.entries(events))for(const [mode,vars] of Object.entries(modes)){
    if(!triggers.includes(trigger))continue;
    rows.push({event,mode,actual:classify(evaluate(expression,github,vars)),expected:expected(event,mode)});
  }
  return rows;
}

function runsOnPullRequests(job){
  if(job.if===undefined)return true;
  return prEvents.some(e=>{
    try{return Boolean(evaluate(String(job.if),events[e].github,{}));}catch{return true;}
  });
}

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
        secrets:/\bsecrets\b(?!\s*\.\s*GITHUB_TOKEN\b)/.test(JSON.stringify({env:workflow.env,job})),
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
    }else if(typeof runsOn==='string'&&hostedLabel.test(runsOn)){
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
