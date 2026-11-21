'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {writeFileSync,mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const sizeOf=require('./index.js');

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAEUlEQVR4nGP4z8DwHxkzEC4AAP7NC/W3Z0w6AAAAAElFTkSuQmCC','base64');

test('Metro 1.x call shapes work on the patched 2.x parser',()=>{
  assert.deepEqual([sizeOf(png).width,sizeOf(png).height],[3,2]);
  const dir=mkdtempSync(join(tmpdir(),'image-size-compat-'));
  try{
    const file=join(dir,'a.png');
    writeFileSync(file,png);
    assert.equal(sizeOf(file).width,3);
    sizeOf(file,(error,result)=>{assert.equal(error,null);assert.equal(result.height,2)});
    assert.equal(sizeOf.default,sizeOf);
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('the adapter uses image-size 2.x, never a vulnerable 1.x line',()=>{
  let dir=require('node:path').dirname(require.resolve('image-size-v2'));
  while(!require('node:fs').existsSync(join(dir,'package.json'))||require(join(dir,'package.json')).name!=='image-size')dir=require('node:path').dirname(dir);
  const version=require(join(dir,'package.json')).version;
  assert.match(version,/^2\./);
  const [major,minor,patch]=version.split('.').map(Number);
  assert.ok(major>2||minor>0||patch>=3,`image-size ${version} is below the patched 2.0.3`);
});

test('invalid input still throws instead of returning bogus dimensions',()=>{
  assert.throws(()=>sizeOf(Buffer.from('not an image')));
  assert.throws(()=>sizeOf(42),TypeError);
  assert.throws(()=>sizeOf('/nonexistent/x.png'),/\/nonexistent\/x\.png/);
  sizeOf(Buffer.from('nope'),(error)=>assert.ok(error instanceof Error));
});
