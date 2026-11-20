/** Verify the published tarball shape, not only local source imports. No registry credentials needed. */
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cwd=join(project,'packages','test-kit');
const temp=await mkdtemp(join(tmpdir(),'tazumo-test-kit-consumer-'));
try{
 const result=execFileSync('npm',['pack','--json','--pack-destination',temp],{cwd,encoding:'utf8'});
 const packed=JSON.parse(result)[0];
 assert.ok(packed?.filename,'npm pack did not produce an archive');
 const files=packed.files.map(x=>x.path);
 assert.ok(files.includes('dist/index.mjs')&&files.includes('dist/index.d.ts')&&files.includes('dist/marketplace.json')&&files.includes('dist/sut.json'));
 assert.ok(files.every(f=>f==='package.json'||f.startsWith('dist/')),'Unexpected source or secret file in package: '+files.join(', '));
 const tarball=join(temp,packed.filename);
 await writeFile(join(temp,'package.json'),'{"private":true,"type":"module"}');
 execFileSync('npm',['install','--no-audit','--no-fund','--ignore-scripts','--prefix',temp,tarball],{cwd:temp,stdio:'pipe'});
 const consumer=`import assert from 'node:assert/strict';
import {fixture} from '@wopee-io-demos/tazumo-test-kit';
assert.equal(fixture.synthetic,true);
assert.ok(fixture.products.length>0);
assert.equal(fixture.brand.name,'Tazumo');
assert.equal(fixture.sut.version,'0.1.0');
assert.equal(fixture.sut.capabilities.realCheckout,false);
console.log('Installed organization test kit passes consumer smoke test:',fixture.artifactVersion);`;
 const consumerPath=join(temp,'consumer.mjs');
 await writeFile(consumerPath,consumer);
 execFileSync(process.execPath,[consumerPath],{cwd:temp,stdio:'inherit'});
 const installed=JSON.parse(await readFile(join(temp,'node_modules','@wopee-io-demos','tazumo-test-kit','package.json'),'utf8'));
 assert.equal(installed.name,'@wopee-io-demos/tazumo-test-kit');
}finally{await rm(temp,{recursive:true,force:true});}
