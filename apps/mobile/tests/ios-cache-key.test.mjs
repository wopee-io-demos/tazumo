import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cacheKey,cacheInputs} from '../scripts/ios-cache-key.mjs';

const script=fileURLToPath(new URL('../scripts/ios-cache-key.mjs',import.meta.url));
const temps=[];
test.after(()=>{for(const d of temps)rmSync(d,{recursive:true,force:true})});
const write=(file,content)=>{mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,content)};

function repo(){
  const root=mkdtempSync(join(tmpdir(),'ios cache key '));temps.push(root);
  const mobile=join(root,'apps','mobile');
  write(join(mobile,'app.json'),'{"expo":{"name":"Tazumo"}}');
  write(join(mobile,'package.json'),'{"name":"@tazumo/mobile"}');
  write(join(mobile,'plugins','with-fmt-cxx17.js'),'module.exports=c=>c');
  write(join(root,'pnpm-workspace.yaml'),'nodeLinker: hoisted\n');
  write(join(root,'package.json'),'{"pnpm":{"overrides":{"image-size":"^2.0.3"}}}');
  write(join(root,'node_modules','react-native','package.json'),'{"name":"react-native","version":"0.79.2"}');
  write(join(root,'node_modules','react-native','React','React-Core.podspec'),'Pod::Spec.new');
  write(join(root,'node_modules','lodash','package.json'),'{"name":"lodash","version":"4.17.21"}');
  return {root,mobile};
}

test('the key is stable for the same native inputs',()=>{
  const {mobile}=repo();
  assert.equal(cacheKey(mobile,'Xcode 27.2'),cacheKey(mobile,'Xcode 27.2'));
  assert.match(cacheKey(mobile,'Xcode 27.2'),/^[0-9a-f]{20}$/);
  assert.deepEqual(cacheInputs(mobile,'Xcode 27.2').nativePackages,['react-native@0.79.2']);
});

test('the key changes with Xcode, the native layer and native package versions',()=>{
  const {root,mobile}=repo();
  const base=cacheKey(mobile,'Xcode 27.2');
  assert.notEqual(cacheKey(mobile,'Xcode 27.3'),base);
  write(join(mobile,'plugins','with-fmt-cxx17.js'),'module.exports=c=>({...c})');
  const plugin=cacheKey(mobile,'Xcode 27.2');
  assert.notEqual(plugin,base);
  write(join(root,'node_modules','react-native','package.json'),'{"name":"react-native","version":"0.79.6"}');
  assert.notEqual(cacheKey(mobile,'Xcode 27.2'),plugin);
});

test('the key changes with overrides, workspace settings, the toolchain and prebuild tools',()=>{
  const {root,mobile}=repo();
  const base=cacheKey(mobile,'Xcode 27.2','1.17.0 v22.19.0');
  assert.notEqual(cacheKey(mobile,'Xcode 27.2','1.17.1 v22.19.0'),base);
  write(join(root,'node_modules','@expo','prebuild-config','package.json'),'{"name":"@expo/prebuild-config","version":"9.0.1"}');
  const tools=cacheKey(mobile,'Xcode 27.2','1.17.0 v22.19.0');
  assert.notEqual(tools,base);
  write(join(root,'package.json'),'{"pnpm":{"overrides":{"image-size":"^2.1.0"}}}');
  const overrides=cacheKey(mobile,'Xcode 27.2','1.17.0 v22.19.0');
  assert.notEqual(overrides,tools);
  write(join(root,'pnpm-workspace.yaml'),'nodeLinker: isolated\n');
  assert.notEqual(cacheKey(mobile,'Xcode 27.2','1.17.0 v22.19.0'),overrides);
});

test('JavaScript-only package and app source changes keep the key',()=>{
  const {root,mobile}=repo();
  const base=cacheKey(mobile,'Xcode 27.2');
  write(join(root,'node_modules','lodash','package.json'),'{"name":"lodash","version":"4.17.22"}');
  write(join(mobile,'src','App.tsx'),'export default null');
  write(join(mobile,'package.json'),'{"name":"@tazumo/mobile","scripts":{"test":"node --test"}}');
  assert.equal(cacheKey(mobile,'Xcode 27.2'),base);
});

test('the CLI refuses to produce a key without the Xcode version',()=>{
  const {mobile}=repo();
  const missing=spawnSync(process.execPath,[script,mobile],{env:{...process.env,XCODE_VERSION:''},encoding:'utf8'});
  assert.notEqual(missing.status,0);
  const ok=spawnSync(process.execPath,[script,mobile],{env:{...process.env,XCODE_VERSION:'Xcode 27.2'},encoding:'utf8'});
  assert.equal(ok.status,0,ok.stderr);
  assert.equal(ok.stdout.trim(),cacheKey(mobile,'Xcode 27.2'));
});
