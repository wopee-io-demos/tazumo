import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRepo,loadRepo} from '../../scripts/check-sut-contract.mjs';
import {checkCompatibility,checkSelectors,contractIds,domains,idSites,yields} from '../../scripts/sut-contract.mjs';

const repo=await loadRepo();
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));

test('the repository contract matches both apps and the fixtures',()=>{
  assert.deepEqual(checkRepo(repo),[]);
});

test('removing every attribute that renders a registered ID fails the check',()=>{
  const dom=domains(repo.core);
  const entries=contractIds(repo.contract);
  assert.ok(entries.length>60);
  for(const {platform,group,key,id} of entries){
    const files=repo.sources[platform as 'web'|'native'];
    const texts=files.map(f=>f.text);
    const hits=idSites(files,platform).filter(site=>yields({literals:new Set(site.literals),templates:new Set(site.templates)},id,dom));
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
  next.version=`${Number(base.version.split('.')[0])+2}.0.0`;
  assert.match(checkCompatibility(base,next).errors[0],/requires version/);
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

test('semantic version: an unchanged contract keeps its version; any other version fails',()=>{
  const base=clone(repo.contract);
  assert.deepEqual(checkCompatibility(base,clone(base)),{level:'none',errors:[],removed:[],changed:[],added:[]});
  const bumped=clone(base);
  bumped.version='9.0.0';
  assert.match(checkCompatibility(base,bumped).errors[0],/none change .* requires version/);
  const patched=clone(base);
  const [major,minor,patch]=base.version.split('.').map(Number);
  patched.version=`${major}.${minor}.${patch+1}`;
  assert.equal(checkCompatibility(base,patched).errors.length,1);
});

const mutate=(platform:'web'|'native',file:string,from:string,to:string)=>{
  const sources=clone(repo.sources);
  const source=sources[platform].find(s=>s.path.endsWith(file))!;
  assert.ok(source.text.includes(from),`${file} lacks ${from}`);
  source.text=source.text.split(from).join(to);
  return checkRepo({...repo,sources});
};

test('IDs that are no longer rendered as test-ID attributes fail the check',()=>{
  const cases:[string,'web'|'native',string,string,string,string][]=[
    ['element commented out','web','main.tsx','<input data-testid="sut-search"','{/* <input data-testid="sut-search" */}<input','web.selectors.search:'],
    ['ID kept in another attribute','web','CartDrawer.tsx','<strong data-testid="sut-cart-subtotal">','<strong title={"sut-cart-subtotal"}>','web.selectors.cartSubtotal:'],
    ['ID kept in a comment','web','CartDrawer.tsx','<strong data-testid="sut-cart-subtotal">','<strong>{/* "sut-cart-subtotal" */}','web.selectors.cartSubtotal:'],
    ['React DOM attribute on native','native','ProductScreen.tsx','testID="sut-detail-title"','data-testid="sut-detail-title"','native.selectors.detailTitle:'],
    ['React Native prop on web','web','CartDrawer.tsx','data-testid="sut-cart-subtotal"','testID="sut-cart-subtotal"','web.selectors.cartSubtotal:'],
    ['prop no longer bound to the test ID','web','common.tsx','data-testid={testId}','','web.selectors.merchantNotFound:'],
    ['checkout no longer disabled','web','CartDrawer.tsx','data-testid="sut-checkout-disabled" disabled','data-testid="sut-checkout-disabled" aria-disabled="false"','web sut-checkout-disabled'],
    ['native checkout disabled={false}','native','CartScreen.tsx','disabled={true}','disabled={false}','native sut-cart-checkout-disabled']
  ];
  for(const [name,platform,file,from,to,expected] of cases)
    assert.ok(mutate(platform,file,from,to).some(e=>e.startsWith(expected)),name);
});

test('equivalent test-ID code does not fail the check',()=>{
  assert.deepEqual(mutate('native','CartScreen.tsx','<Pressable testID="sut-cart-checkout-disabled"','<Pressable disabled={true} testID="sut-cart-checkout-disabled"'),[]);
  assert.deepEqual(mutate('web','common.tsx','data-testid={testId}','data-testid={testId??undefined}'),[]);
});

test('concrete IDs only match a template with a value from that placeholder domain',()=>{
  const c=clone(repo.contract);
  c.web.selectors.merchantPizza='[data-testid="sut-merchant-pizza"]';
  assert.ok(checkSelectors(c,repo.sources,repo.core).some(e=>e.startsWith('web.selectors.merchantPizza:')));
});

test('removing an empty container or reordering platforms is classified correctly',()=>{
  const base=clone(repo.contract);
  base.web.extra={};
  assert.equal(checkCompatibility(base,clone(repo.contract)).level,'major');
  const reordered=clone(repo.contract);
  reordered.journeys[0].platforms.reverse();
  assert.equal(checkCompatibility(repo.contract,reordered).level,'none');
});
