import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'yaml';
import {buildInfo,repoRoot,resolveCommit} from '../../scripts/build-info.mjs';
import {checkOpenapiVersion,compareSemver} from '../../scripts/check-openapi-version.mjs';

const read=(path:string)=>readFileSync(join(repoRoot,path),'utf8');
const json=(path:string)=>JSON.parse(read(path));
const config=json('release-please-config.json');
const productVersion=json('.release-please-manifest.json')['.'];
const sha='0123456789abcdef0123456789abcdef01234567';

test('one product version: the manifest, the root package and every release-please extra file agree',()=>{
  assert.deepEqual(Object.keys(config.packages),['.']);
  assert.equal(config['release-type'],'node');
  assert.equal(config['include-component-in-tag'],false);
  assert.match(productVersion,/^\d+\.\d+\.\d+$/);
  assert.equal(json('package.json').version,productVersion);
  const extra=config.packages['.']['extra-files'];
  assert.deepEqual(extra.map((f:{path:string})=>f.path).sort(),
    ['apps/api/package.json','apps/backoffice/package.json','apps/mobile/app.json','apps/mobile/package.json','apps/web/package.json']);
  for(const {type,path,jsonpath} of extra){
    assert.equal(type,'json');
    const value=jsonpath.slice(2).split('.').reduce((o:Record<string,unknown>,k:string)=>o[k] as Record<string,unknown>,json(path));
    assert.equal(value,productVersion,`${path} ${jsonpath}`);
  }
});

test('pre-1.0 bumps: breaking changes and features bump the minor version, fixes the patch',()=>{
  assert.equal(config['bump-minor-pre-major'],true);
  assert.equal(config['bump-patch-for-minor-pre-major'],false);
});

test('the release workflow is pinned and holds write permissions only on its push-to-main job',()=>{
  const workflow=parse(read('.github/workflows/release.yml'));
  assert.deepEqual(workflow.on,{push:{branches:['main']}});
  assert.deepEqual(workflow.permissions,{});
  const jobs=Object.values(workflow.jobs) as {permissions:unknown,'runs-on':string,steps:{uses?:string}[]}[];
  assert.equal(jobs.length,1);
  assert.deepEqual(jobs[0].permissions,{contents:'write','pull-requests':'write'});
  assert.equal(jobs[0]['runs-on'],'ubuntu-latest');
  const uses=jobs[0].steps.map(s=>s.uses).filter(Boolean);
  assert.deepEqual(uses.map(u=>u!.split('@')[0]),['googleapis/release-please-action']);
  assert.match(uses[0]!,/@[0-9a-f]{40}$/);
});

test('build identity reads the product and contract versions from the repository',()=>{
  const info=buildInfo({env:{TAZUMO_COMMIT:sha},now:new Date('2026-11-21T10:00:00Z')});
  assert.deepEqual(info,{version:productVersion,commit:sha,builtAt:'2026-11-21T10:00:00.000Z',
    contracts:{sut:json('contracts/sut.json').version,openapi:json('contracts/openapi.json').info.version}});
});

test('the commit comes from TAZUMO_COMMIT, GITHUB_SHA or git, and is "unknown" otherwise',()=>{
  assert.equal(resolveCommit({TAZUMO_COMMIT:sha,GITHUB_SHA:'f'.repeat(40)}),sha);
  assert.equal(resolveCommit({GITHUB_SHA:sha}),sha);
  assert.equal(resolveCommit({}),execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim());
  for(const bad of ['main','abc1234',`${sha}\n`,sha.toUpperCase(),'$(id)'])assert.equal(resolveCommit({TAZUMO_COMMIT:bad}),'unknown',bad);
  const outside=mkdtempSync(join(tmpdir(),'tazumo-no-git-'));
  try{assert.equal(resolveCommit({},outside),'unknown')}finally{rmSync(outside,{recursive:true,force:true})}
});

test('native build numbers come from TAZUMO_BUILD_NUMBER and default to 1',()=>{
  const appConfig=createRequire(import.meta.url)('../../apps/mobile/app.config.js');
  const {expo}=json('apps/mobile/app.json');
  const resolve=(value?:string)=>{
    const previous=process.env.TAZUMO_BUILD_NUMBER;
    if(value===undefined)delete process.env.TAZUMO_BUILD_NUMBER;else process.env.TAZUMO_BUILD_NUMBER=value;
    try{return appConfig({config:structuredClone(expo)})}finally{if(previous===undefined)delete process.env.TAZUMO_BUILD_NUMBER;else process.env.TAZUMO_BUILD_NUMBER=previous}
  };
  assert.equal(expo.ios.buildNumber,undefined,'build numbers are never committed');
  assert.equal(expo.android.versionCode,undefined,'build numbers are never committed');
  const local=resolve();
  assert.equal(local.ios.buildNumber,'1');
  assert.equal(local.android.versionCode,1);
  const ci=resolve('4217');
  assert.equal(ci.ios.buildNumber,'4217');
  assert.equal(ci.android.versionCode,4217);
  assert.equal(ci.version,expo.version);
  assert.equal(ci.ios.bundleIdentifier,expo.ios.bundleIdentifier);
  assert.equal(ci.android.package,expo.android.package);
  for(const bad of ['0','-3','1.5','abc','2100000001','01'])assert.throws(()=>resolve(bad),/TAZUMO_BUILD_NUMBER/,bad);
});

test('semver precedence follows the specification',()=>{
  const ordered=['0.7.0-alpha','0.7.0-alpha.1','0.7.0-alpha.beta','0.7.0-beta','0.7.0-beta.2','0.7.0-beta.11','0.7.0-draft','0.7.0','0.7.1','0.8.0-draft','0.10.0','1.0.0'];
  for(let i=1;i<ordered.length;i++)assert.ok(compareSemver(ordered[i-1],ordered[i])<0,`${ordered[i-1]} < ${ordered[i]}`);
  assert.equal(compareSemver('0.7.0+build.1','0.7.0'),0);
});

test('the OpenAPI version must change, and increase, whenever the contract changes',()=>{
  const spec=json('contracts/openapi.json');
  const edit=(version:string,change=true)=>{const next=structuredClone(spec);next.info.version=version;if(change)next.info.description+=' Changed.';return next};
  assert.deepEqual(checkOpenapiVersion(null,spec),[]);
  assert.deepEqual(checkOpenapiVersion(spec,structuredClone(spec)),[]);
  assert.match(checkOpenapiVersion(spec,edit(spec.info.version)).join(),/changed but info.version is still/);
  assert.deepEqual(checkOpenapiVersion(spec,edit('0.8.0-draft')),[]);
  assert.deepEqual(checkOpenapiVersion(spec,edit('0.7.0',false)),[]);
  assert.match(checkOpenapiVersion(spec,edit('0.6.0-draft')).join(),/must be greater than/);
  assert.match(checkOpenapiVersion(spec,edit('0.7.0-alpha',false)).join(),/must be greater than/);
  for(const bad of ['0.8','v0.8.0','0.8.0-','08.0.0'])assert.match(checkOpenapiVersion(spec,edit(bad)).join(),/is not a semantic version/,bad);
});
