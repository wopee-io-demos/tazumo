import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRepo,loadRepo} from '../../scripts/check-sut-contract.mjs';
import {checkCompatibility,checkSelectors,contractIds,domains,idSites,yields} from '../../scripts/sut-contract.mjs';

const repo=await loadRepo();
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));

test('the repository contract matches both apps and the fixtures',()=>{
  assert.deepEqual(checkRepo(repo),[]);
});

test('removing any registered ID from the source fails the check',()=>{
  const values=new Set(Object.values(domains(repo.core)).flat());
  const entries=contractIds(repo.contract);
  assert.ok(entries.length>60);
  for(const {platform,group,key,id} of entries){
    const files=repo.sources[platform as 'web'|'native'];
    const texts=files.map(f=>f.text);
    const hits=idSites(texts).filter(site=>yields({literals:new Set(site.literals),templates:new Set(site.templates)},id,values));
    assert.ok(hits.length>0,`${platform}.${group}.${key}: no source site`);
    const mutated=texts.slice();
    for(const site of hits.sort((a,b)=>b.start-a.start)){
      const t=mutated[site.file];
      mutated[site.file]=t.slice(0,site.start)+'"removed"'+t.slice(site.end);
    }
    const sources={...repo.sources,[platform]:files.map((f,i)=>({...f,text:mutated[i]}))};
    const errors=checkSelectors(repo.contract,sources,repo.core);
    assert.ok(errors.some(e=>e.startsWith(`${platform}.${group}.${key}:`)),`${platform}.${group}.${key} (${id}) still passes after removal`);
  }
});

test('a selector that is not a sut-* test ID is rejected',()=>{
  const c=clone(repo.contract);
  c.web.selectors.search='#search';
  c.native.selectorTemplates.product='sut-product-{sku}';
  const errors=checkSelectors(c,repo.sources,repo.core);
  assert.ok(errors.some(e=>e.startsWith('web.selectors.search:')));
  assert.ok(errors.some(e=>e.includes('unknown placeholder {sku}')));
});

test('fixture drift between the contract and @tazumo/core fails',()=>{
  const c=clone(repo.contract);
  c.fixtures.products[0].priceMinor+=1;
  assert.ok(checkRepo({...repo,contract:c}).some(e=>e.includes('priceMinor')));
});

test('semantic version: renames and removals need a major bump',()=>{
  const base=clone(repo.contract),next=clone(repo.contract);
  next.web.selectors.searchBox=next.web.selectors.search;
  delete next.web.selectors.search;
  assert.equal(checkCompatibility(base,next).level,'major');
  assert.match(checkCompatibility(base,next).errors[0],/major change/);
  next.version=`${Number(base.version.split('.')[0])+1}.0.0`;
  assert.deepEqual(checkCompatibility(base,next).errors,[]);
});

test('semantic version: changing an ID value needs a major bump',()=>{
  const base=clone(repo.contract),next=clone(repo.contract);
  next.native.selectors.search='sut-search-field';
  const r=checkCompatibility(base,next);
  assert.equal(r.level,'major');
  assert.deepEqual(r.changed,['native.selectors.search']);
  assert.equal(r.errors.length,1);
});

test('semantic version: additions need a minor bump, prose edits a patch bump',()=>{
  const base=clone(repo.contract);
  const added=clone(base);
  added.web.selectors.extra='[data-testid="sut-extra"]';
  assert.equal(checkCompatibility(base,added).level,'minor');
  assert.equal(checkCompatibility(base,added).errors.length,1);
  const [major,minor]=base.version.split('.').map(Number);
  added.version=`${major}.${minor+1}.0`;
  assert.deepEqual(checkCompatibility(base,added).errors,[]);
  const prose=clone(base);
  prose.journeys[0].steps[0]+=' (reworded)';
  assert.equal(checkCompatibility(base,prose).level,'patch');
  assert.equal(checkCompatibility(base,prose).errors.length,1);
});

test('semantic version: an unchanged contract passes and a gratuitous major bump fails',()=>{
  const base=clone(repo.contract);
  assert.deepEqual(checkCompatibility(base,clone(base)),{level:'none',errors:[],removed:[],changed:[],added:[]});
  const bumped=clone(base);
  bumped.version='9.0.0';
  assert.match(checkCompatibility(base,bumped).errors[0],/without a breaking change/);
});
