import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {classify,changedFiles,outputs} from './ci-changes.mjs';

const on=(r)=>Object.entries(r).filter(([,v])=>v).map(([k])=>k).sort();

test('non-PR events and empty diffs run everything',()=>{
  for(const event of ['push','schedule','workflow_dispatch']){
    assert.deepEqual(on(classify(['README.md'],{event})),outputs.filter(k=>k!=='docs_only').sort());
  }
  assert.equal(classify([]).full,true);
});

test('pull requests into a branch other than main run everything',()=>{
  assert.equal(classify(['README.md'],{base:'feature/x'}).full,true);
  assert.equal(classify(['README.md'],{base:'main'}).docs_only,true);
});

test('docs-only changes skip all code work',()=>{
  const r=classify(['README.md','docs/TESTING.md','openspec/changes/x/tasks.md','docs/adr/0010-x.md','apps/web/README.md','docs/screenshots/web/a.png','.github/ISSUE_TEMPLATE/feature.md','LICENSE']);
  assert.deepEqual(on(r),['docs_only']);
});

test('web-only changes build and test the web, not the mobile bundle',()=>{
  assert.deepEqual(on(classify(['apps/web/src/main.tsx'])),['code','jsts','web']);
  assert.deepEqual(on(classify(['tests/e2e/a11y.spec.ts'])),['code','jsts','web']);
  assert.deepEqual(on(classify(['contracts/sut.json'])),['code','jsts','web']);
});

test('shared packages trigger web; only core and brand trigger mobile',()=>{
  assert.deepEqual(on(classify(['packages/core/src/index.ts'])),['code','jsts','mobile','web']);
  assert.deepEqual(on(classify(['packages/brand/src/index.ts'])),['code','jsts','mobile','web']);
  assert.deepEqual(on(classify(['packages/address/src/index.ts'])),['code','jsts','web']);
});

test('mobile-only changes bundle mobile without web e2e',()=>{
  assert.deepEqual(on(classify(['apps/mobile/src/App.tsx'])),['code','jsts','mobile']);
});

test('api-only changes run typecheck and tests but no web or mobile work',()=>{
  assert.deepEqual(on(classify(['apps/api/src/app.ts'])),['code','jsts']);
  assert.deepEqual(on(classify(['apps/api/migrations/0004_x.sql'])),['code']);
});

test('package manifests trigger the dependency audit',()=>{
  const r=classify(['apps/api/package.json']);
  assert.equal(r.deps,true);
  assert.equal(r.full,false);
});

test('root install files and pipeline files run everything',()=>{
  for(const f of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.npmrc','tsconfig.base.json','.github/workflows/ci.yml','.github/workflows/test-evidence.yml','.github/workflows/security.yml','.github/workflows/codeql.yml','scripts/ci-changes.mjs','scripts/ci-changes.test.mjs']){
    const r=classify([f]);
    assert.equal(r.full,true,f);
    assert.deepEqual(on(r),outputs.filter(k=>k!=='docs_only').sort(),f);
  }
});

test('other workflow changes run the runner guard only',()=>{
  assert.deepEqual(on(classify(['.github/workflows/screenshots.yml'])),['code','guard']);
  assert.deepEqual(on(classify(['scripts/check-runner-guard.mjs'])),['code','guard','jsts']);
});

test('a docs file next to code does not hide the code',()=>{
  assert.deepEqual(on(classify(['README.md','apps/mobile/src/App.tsx'])),['code','jsts','mobile']);
});

test('CodeQL runs for JS, TS, HTML, JSON and YAML, not for shell, Python or SQL',()=>{
  for(const f of ['apps/web/index.html','contracts/sut.json','scripts/x.cjs','apps/api/src/x.mts','tests/demo/flow.yaml'])assert.equal(classify([f]).jsts,true,f);
  for(const f of ['scripts/issue-status.sh','scripts/audit_issue_board.py','apps/api/migrations/0004_x.sql'])assert.equal(classify([f]).jsts,false,f);
});

test('changedFiles lists additions, edits, deletions and both sides of a rename on a merge commit',()=>{
  const dir=mkdtempSync(join(tmpdir(),'a4-ci-changes-'));
  const git=(...a)=>execFileSync('git',['-C',dir,'-c','user.name=t','-c','user.email=t@example.invalid','-c','commit.gpgsign=false',...a],{encoding:'utf8'});
  try{
    git('init','-q','-b','main');
    mkdirSync(join(dir,'apps/web'),{recursive:true});
    writeFileSync(join(dir,'apps/web/a.ts'),'a\n');
    writeFileSync(join(dir,'gone.ts'),'g\n');
    git('add','.');git('commit','-qm','base');
    git('checkout','-qb','feature');
    git('mv','apps/web/a.ts','apps/web/a.md');
    git('rm','-q','gone.ts');
    writeFileSync(join(dir,'new.ts'),'n\n');
    git('add','.');git('commit','-qm','change');
    git('checkout','-q','main');
    git('merge','-q','--no-ff','-m','merge','feature');
    assert.deepEqual(changedFiles({cwd:dir}).sort(),['apps/web/a.md','apps/web/a.ts','gone.ts','new.ts']);
    assert.equal(classify(['apps/web/a.md','apps/web/a.ts']).web,true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
