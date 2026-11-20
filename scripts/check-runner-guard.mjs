import {readFileSync,readdirSync} from 'node:fs';
import {parse} from 'yaml';
import {Evaluator,Lexer,Parser,data} from '@actions/expressions';

export const repository='wopee-io-demos/tazumo';
export const hosted='ubuntu-latest';
export const unguardedExpression="vars.RUNNER_MODE == 'hosted' && 'ubuntu-latest' || fromJSON('[\"self-hosted\",\"linux\",\"x64\",\"demos\"]')";

const pr=(headRepo)=>({event_name:'pull_request',repository,event:{pull_request:{number:1,head:{repo:headRepo&&{full_name:headRepo}}}}});
export const events={
  'push to main':{event_name:'push',repository,event:{}},
  'schedule':{event_name:'schedule',repository,event:{}},
  'workflow_dispatch':{event_name:'workflow_dispatch',repository,event:{}},
  'same-repo PR':pr(repository),
  'fork PR':pr('someone/tazumo'),
  'PR from deleted fork':pr(null)
};
export const modes={'RUNNER_MODE=hosted':{RUNNER_MODE:'hosted'},'RUNNER_MODE unset':{},'RUNNER_MODE=self-hosted':{RUNNER_MODE:'self-hosted'}};
const untrusted=new Set(['fork PR','PR from deleted fork']);

export function evaluate(expression,github,vars){
  const lexed=new Lexer(expression).lex();
  const tree=new Parser(lexed.tokens,['github','vars'],[]).parse();
  const context=JSON.parse(JSON.stringify({github,vars}),data.reviver);
  const result=new Evaluator(tree,context).evaluate();
  return JSON.parse(JSON.stringify(result,data.replacer));
}

export const expected=(event,mode)=>mode==='RUNNER_MODE=hosted'||untrusted.has(event)?'hosted':'self-hosted';
const classify=(runner)=>runner===hosted?'hosted':Array.isArray(runner)&&runner.includes('self-hosted')?'self-hosted':`unexpected ${JSON.stringify(runner)}`;

const triggerOf={'push to main':'push','schedule':'schedule','workflow_dispatch':'workflow_dispatch','same-repo PR':'pull_request','fork PR':'pull_request','PR from deleted fork':'pull_request'};

export function matrix(expression,triggers=Object.values(triggerOf)){
  const rows=[];
  for(const [event,github] of Object.entries(events))for(const [mode,vars] of Object.entries(modes)){
    if(!triggers.includes(triggerOf[event]))continue;
    const actual=classify(evaluate(expression,github,vars));
    rows.push({event,mode,actual,expected:expected(event,mode)});
  }
  return rows;
}

export function workflowJobs(dir=new URL('../.github/workflows/',import.meta.url)){
  const jobs=[];
  for(const file of readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)).sort()){
    const source=readFileSync(new URL(file,dir),'utf8');
    const workflow=parse(source);
    const on=workflow.on??workflow[true];
    const triggers=typeof on==='string'?[on]:Array.isArray(on)?on:Object.keys(on??{});
    const usesSecrets=/\bsecrets\./.test(source);
    for(const [id,job] of Object.entries(workflow.jobs??{})){
      const permissions=[workflow.permissions,job.permissions];
      const writes=permissions.some(p=>p==='write-all'||(p&&typeof p==='object'&&Object.values(p).includes('write')));
      jobs.push({file,id,triggers,runsOn:job['runs-on'],usesSecrets,writes});
    }
  }
  return jobs;
}

export function check(){
  const failures=[],report=[];
  for(const job of workflowJobs()){
    const name=`${job.file}#${job.id}`;
    if(job.triggers.includes('pull_request_target'))failures.push(`${name}: pull_request_target is not allowed`);
    if(job.triggers.includes('pull_request')&&job.usesSecrets)failures.push(`${name}: pull_request workflow references secrets`);
    if(job.triggers.includes('pull_request')&&job.writes)failures.push(`${name}: pull_request workflow grants write permissions`);
    const runsOn=job.runsOn;
    if(typeof runsOn==='string'&&runsOn.startsWith('${{')){
      const rows=matrix(runsOn.replace(/^\$\{\{\s*|\s*\}\}$/g,''),job.triggers);
      for(const r of rows)if(r.actual!==r.expected)failures.push(`${name}: ${r.event}, ${r.mode} -> ${r.actual}, expected ${r.expected}`);
      report.push({name,triggers:job.triggers,rows});
    }else{
      const labels=[runsOn].flat().map(String);
      if(labels.includes('self-hosted')&&job.triggers.includes('pull_request'))failures.push(`${name}: static self-hosted runner on a pull_request workflow`);
      report.push({name,triggers:job.triggers,static:labels.join(',')});
    }
  }
  return {failures,report};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const control=matrix(unguardedExpression).filter(r=>r.actual!==r.expected);
  if(!control.some(r=>r.event==='fork PR'&&r.mode==='RUNNER_MODE unset'&&r.actual==='self-hosted')){
    console.error('Control failed: the unguarded expression should route an unset-mode fork PR to self-hosted');
    process.exit(1);
  }
  const {failures,report}=check();
  for(const job of report){
    if(job.static){console.log(`${job.name} [${job.triggers.join(', ')}]: static ${job.static}`);continue;}
    console.log(`${job.name} [${job.triggers.join(', ')}]`);
    for(const r of job.rows)console.log(`  ${r.event.padEnd(20)} ${r.mode.padEnd(23)} -> ${r.actual}${r.actual===r.expected?'':'  FAIL'}`);
  }
  console.log(`Control: the previous unguarded expression fails ${control.length} cases, including an unset-mode fork PR on self-hosted.`);
  if(failures.length){console.error(failures.join('\n'));process.exit(1);}
  console.log('Runner guard verified: fork pull requests never reach the self-hosted pool, and pull_request workflows use no secrets or write permissions.');
}
