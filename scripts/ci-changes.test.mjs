import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify,outputs} from './ci-changes.mjs';

const on=(r)=>Object.entries(r).filter(([,v])=>v).map(([k])=>k).sort();

test('non-PR events and empty diffs run everything',()=>{
  for(const event of ['push','schedule','workflow_dispatch']){
    assert.deepEqual(on(classify(['README.md'],{event})),outputs.filter(k=>k!=='docs_only').sort());
  }
  assert.equal(classify([]).full,true);
});

test('docs-only changes skip all code work',()=>{
  const r=classify(['README.md','docs/TESTING.md','openspec/changes/x/tasks.md','docs/adr/0010-x.md','apps/web/README.md','docs/screenshots/web/a.png']);
  assert.deepEqual(on(r),['docs_only']);
});

test('web-only changes build and test the web, not the mobile bundle',()=>{
  assert.deepEqual(on(classify(['apps/web/src/main.tsx'])),['code','jsts','shots_web','web']);
  assert.deepEqual(on(classify(['tests/e2e/a11y.spec.ts'])),['code','jsts','web']);
  assert.deepEqual(on(classify(['contracts/sut.json'])),['code','jsts','web']);
});

test('shared packages trigger web; only core and brand trigger mobile',()=>{
  assert.deepEqual(on(classify(['packages/core/src/index.ts'])),['code','jsts','mobile','shots_native','shots_web','web']);
  assert.deepEqual(on(classify(['packages/brand/src/index.ts'])),['code','jsts','mobile','shots_native','shots_web','web']);
  assert.deepEqual(on(classify(['packages/address/src/index.ts'])),['code','jsts','web']);
});

test('mobile-only changes bundle mobile without web e2e',()=>{
  assert.deepEqual(on(classify(['apps/mobile/src/App.tsx'])),['code','jsts','mobile','shots_native']);
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
  for(const f of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.github/workflows/ci.yml','.github/workflows/test-evidence.yml','scripts/ci-changes.mjs']){
    const r=classify([f]);
    assert.equal(r.full,true,f);
    assert.deepEqual(on(r),outputs.filter(k=>k!=='docs_only').sort(),f);
  }
});

test('other workflow changes run the runner guard only',()=>{
  assert.deepEqual(on(classify(['.github/workflows/screenshots.yml'])),['code','guard','shots_native','shots_web']);
  assert.deepEqual(on(classify(['scripts/check-runner-guard.mjs'])),['code','guard','jsts']);
});

test('screenshot jobs follow the shipped web or native code, not tests',()=>{
  const web=classify(['apps/web/src/main.tsx']);
  assert.equal(web.shots_web,true);
  assert.equal(web.shots_native,false);
  const mobile=classify(['apps/mobile/src/App.tsx']);
  assert.equal(mobile.shots_web,false);
  assert.equal(mobile.shots_native,true);
  const shared=classify(['packages/core/src/index.ts']);
  assert.equal(shared.shots_web&&shared.shots_native,true);
  const tests=classify(['packages/core/src/index.test.ts','apps/mobile/src/shopping.test.ts']);
  assert.equal(tests.shots_web||tests.shots_native,false);
  assert.equal(classify(['tests/screenshots/native/ios.sh']).shots_web,false);
  assert.equal(classify(['packages/address/src/index.ts']).shots_native,false);
});

test('a docs file next to code does not hide the code',()=>{
  assert.deepEqual(on(classify(['README.md','apps/mobile/src/App.tsx'])),['code','jsts','mobile','shots_native']);
});
