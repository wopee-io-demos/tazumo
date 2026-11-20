/** Prevent drift between contracts/sut.json, the web and native sources, the fixtures and the published contract version.
 * Usage: node --experimental-strip-types scripts/check-sut-contract.mjs [--base <git-ref>]
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkCompatibility,checkDisabled,checkFixtures,checkRoutes,checkSelectors,unregistered} from './sut-contract.mjs';

const root=resolve(fileURLToPath(import.meta.url),'../..');
const read=p=>readFileSync(join(root,p),'utf8');

export function sourcesIn(dir){
  const out=[];
  const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){
    const p=join(d,e.name);
    if(e.isDirectory())walk(p);
    else if(/\.tsx?$/.test(e.name)&&!/\.test\.tsx?$/.test(e.name))out.push({path:relative(root,p),text:readFileSync(p,'utf8')});
  }};
  walk(join(root,dir));
  return out;
}

export async function loadRepo(){
  const core=await import('../packages/core/src/index.ts');
  return {
    contract:JSON.parse(read('contracts/sut.json')),
    core:{products:core.products,merchants:core.merchants,categories:core.categories,languages:core.languages},
    sources:{web:sourcesIn('apps/web/src'),native:sourcesIn('apps/mobile/src')}
  };
}

/** Structural and behavioural checks that do not depend on a previous contract version. */
export function checkRepo({contract,core,sources}){
  return [...checkSelectors(contract,sources,core),...checkRoutes(contract,sources,core),...checkFixtures(contract,core),
    ...checkDisabled(sources.native,'native',['sut-checkout-disabled','sut-cart-checkout-disabled']),
    ...checkDisabled(sources.web,'web',['sut-checkout-disabled'])];
}

function git(args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']})}

/** The contract published at a git ref, or null when the ref exists but has no contract. Throws on a bad ref. */
export function baseContract(ref){
  if(!ref||ref.startsWith('-'))throw new Error('--base needs a git ref');
  try{git(['rev-parse','--verify','--quiet',`${ref}^{commit}`])}catch{throw new Error(`--base ${ref} is not a commit`)}
  try{git(['cat-file','-e',`${ref}:contracts/sut.json`])}catch{return null}
  return JSON.parse(git(['show',`${ref}:contracts/sut.json`]));
}

async function main(){
  const repo=await loadRepo(),{contract}=repo;
  assert.equal(contract.schemaVersion,1);
  assert.equal(contract.status,'synthetic-only');
  assert.ok(JSON.parse(read('package.json')).scripts['dev:sut']?.includes('--port 4173 --strictPort'),'Dev SUT script must serve contract local URL on port 4173');
  const expo=JSON.parse(read('apps/mobile/app.json')).expo;
  assert.equal(contract.native.iosBundleId,'io.wopee.demos.tazumo');
  assert.equal(contract.native.androidPackage,'io.wopee.demos.tazumo');
  assert.equal(expo.android.package,contract.native.androidPackage);
  assert.equal(expo.ios.bundleIdentifier,contract.native.iosBundleId);
  assert.deepEqual(contract.native.locatorStrategies,{ios:'accessibility id',android:'id'});
  assert.equal(contract.capabilities.realCheckout,false);
  assert.equal(contract.capabilities.realDeliveryTracking,false);

  const errors=checkRepo(repo);
  const i=process.argv.indexOf('--base');
  if(i>0){
    const ref=process.argv[i+1];
    const base=baseContract(ref);
    const result=checkCompatibility(base,contract);
    errors.push(...result.errors);
    console.log(base?`Compared with ${ref} (v${base.version}): ${result.level} change.`:`No contract at ${ref}; initial version.`);
  }

  for(const [platform,ids] of Object.entries(unregistered(contract,repo.sources,repo.core)))
    if(ids.length)console.log(`Note: ${platform} IDs not in the contract: ${ids.join(', ')}`);
  if(errors.length){console.error(errors.map(e=>'SUT contract: '+e).join('\n'));process.exit(1)}
  const count=p=>Object.keys(contract[p].selectors).length+Object.keys(contract[p].selectorTemplates??{}).length;
  console.log(`Tazumo SUT v${contract.version}: ${count('web')} web and ${count('native')} native selectors found in ${repo.sources.web.length}+${repo.sources.native.length} source files; fixtures match @tazumo/core.`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
