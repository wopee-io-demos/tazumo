import {appendFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const any=(files,...patterns)=>files.some(f=>patterns.some(p=>p.test(f)));
const docs=[/\.md$/,/^docs\//,/^openspec\//,/^\.github\/ISSUE_TEMPLATE\//,/^LICENSE$/];
const isDocs=(f)=>docs.some(p=>p.test(f));
const install=[/^package\.json$/,/^pnpm-workspace\.yaml$/,/^pnpm-lock\.yaml$/,/^\.npmrc$/,/^tsconfig[^/]*\.json$/];
const pipeline=[/^\.github\/workflows\/(ci|test-evidence|security|codeql)\.yml$/,/^scripts\/ci-changes(\.test)?\.mjs$/];

export const outputs=['full','docs_only','code','web','mobile','deps','guard','jsts'];

export function classify(files,{event='pull_request',base='main'}={}){
  if(event!=='pull_request'||base!=='main'||files.length===0){
    return Object.fromEntries(outputs.map(k=>[k,k!=='docs_only']));
  }
  const code=files.filter(f=>!isDocs(f));
  const full=any(code,...install,...pipeline);
  const result={
    full,
    docs_only:code.length===0,
    code:code.length>0,
    web:full||any(code,/^apps\/web\//,/^packages\//,/^tests\/e2e\//,/^contracts\//,/^playwright\.config\.ts$/),
    mobile:full||any(code,/^apps\/mobile\//,/^packages\/(core|brand)\//),
    deps:full||any(code,/(^|\/)package\.json$/,/^pnpm-lock\.yaml$/,/^pnpm-workspace\.yaml$/,/^\.npmrc$/),
    guard:full||any(code,/^\.github\/workflows\//,/^scripts\/check-runner-guard\.mjs$/),
    jsts:full||any(code.filter(f=>!/^\.github\/workflows\//.test(f)),/\.(c|m)?[jt]sx?$/,/\.(mts|cts|html?|vue|json|ya?ml)$/,/^\.github\/codeql\//)
  };
  return result;
}

export function changedFiles({base='HEAD^1',head='HEAD',cwd}={}){
  return execFileSync('git',['diff','--name-only','--no-renames',base,head],{encoding:'utf8',cwd}).split('\n').filter(Boolean);
}

const entry=process.argv[1]&&pathToFileURL(realpathSync(process.argv[1])).href;
if(import.meta.url===entry){
  const event=process.env.GITHUB_EVENT_NAME??'pull_request';
  const base=process.env.GITHUB_BASE_REF||'main';
  const files=event==='pull_request'?changedFiles():[];
  const result=classify(files,{event,base});
  const lines=Object.entries(result).map(([k,v])=>`${k}=${v}`);
  console.log(`Event ${event}, base ${base}, ${files.length} changed file(s)`);
  for(const f of files.slice(0,50))console.log(`  ${f}`);
  if(files.length>50)console.log(`  ... ${files.length-50} more`);
  console.log(lines.join('\n'));
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,lines.join('\n')+'\n');
}
