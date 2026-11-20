import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const pkg=JSON.parse(await readFile(new URL('../packages/test-kit/package.json',import.meta.url)));
test('organization-scoped package only publishes fixture assets',async()=>{
 assert.equal(pkg.name,'@wopee-io-demos/tazumo-test-kit');
 assert.equal(pkg.publishConfig.registry,'https://npm.pkg.github.com');
 assert.deepEqual(pkg.files,['dist']);
});
test('generated fixtures match typed source of truth',async()=>{
 const core=await import('../packages/core/src/index.ts');
 const brand=await import('../packages/brand/src/index.ts');
 const artifact=(await import('../packages/test-kit/dist/index.mjs')).fixture;
 assert.equal(artifact.synthetic,true);
 assert.equal(artifact.sut.version,'0.1.0');
 assert.equal(artifact.sut.capabilities.realCheckout,false);
 assert.equal(artifact.sut.native.androidPackage,'io.wopee.demos.tazumo');
 assert.equal(artifact.products.length,core.products.length);
 assert.equal(artifact.brand.name,brand.brandName);
 assert.equal(artifact.brand.palettes.coral.primary,brand.palettes.coral.primary);
 assert.ok(artifact.products.every(p=>p.priceCents>=0));
 assert.ok(!JSON.stringify(artifact).includes('password'));
});
