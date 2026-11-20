/** Prevent silent drift between SUT version, demo selectors and source fixtures. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(p),'utf8');
const contract=JSON.parse(read('contracts/sut.json'));
assert.equal(contract.schemaVersion,1);
const packageScripts=JSON.parse(read('package.json')).scripts;
assert.ok(packageScripts['dev:sut']?.includes('--port 4173 --strictPort'),'Dev SUT script must serve contract local URL on port 4173');
assert.match(contract.version,/^0\.1\.[0-9]+$/);
assert.equal(contract.status,'synthetic-only');
assert.equal(contract.native.iosBundleId,'io.wopee.demos.tazumo');
assert.equal(contract.native.androidPackage,'io.wopee.demos.tazumo');
assert.deepEqual(contract.native.locatorStrategies,{ios:'accessibility id',android:'id'});
assert.equal(contract.capabilities.realCheckout,false);
assert.equal(contract.capabilities.realDeliveryTracking,false);
const nativeConfig=JSON.parse(read('apps/mobile/app.json')).expo;
assert.equal(nativeConfig.android.package,contract.native.androidPackage);
assert.equal(nativeConfig.ios.bundleIdentifier,contract.native.iosBundleId);
const core=read('packages/core/src/index.ts');
const web=read('apps/web/src/main.tsx');
const mobile=read('apps/mobile/src/App.tsx');
for(const entry of contract.fixtures.products){
 assert.match(core,new RegExp("id:'"+entry.id+"'"),'Fixture missing from core: '+entry.id);
 assert.ok(core.includes("name:'"+entry.name+"'"),'Fixture name not present: '+entry.name);
 assert.ok(core.includes('priceCents:'+entry.priceMinor),'Expected demo fixture price absent: '+entry.priceMinor);
}
for(const [key,selector] of Object.entries(contract.web.selectors)){
 assert.match(selector,/^\[data-testid="sut-[a-z0-9-]+"\]$/,'Web selector not a stable test ID: '+key);
}
for(const [key,selector] of Object.entries(contract.native.selectors)){
 assert.match(selector,/^sut-[a-z0-9-]+$/,'Native selector not a stable test ID: '+key);
}
for(const token of ['sut-cart-open','sut-search','sut-cart-dialog','sut-language','sut-palette','sut-product-','sut-add-']){
 assert.ok(web.includes(token),'Web UI missing selector: '+token);
}
for(const token of ['sut-cart-open','sut-search','sut-cart-summary','sut-language-','sut-product-','sut-add-']){
 assert.ok(mobile.includes(token),'Native UI missing selector: '+token);
}
console.log('Tazumo SUT v'+contract.version+' contract checked against native app IDs, fixture keys, web and mobile selectors.');

assert.ok(mobile.includes('testID="sut-checkout-disabled"') && mobile.includes('disabled={true}'),'Native checkout must expose a genuinely disabled test control');
