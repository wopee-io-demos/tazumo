import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const spec=JSON.parse(readFileSync(new URL('../contracts/openapi.json',import.meta.url),'utf8'));
assert.equal(spec.openapi,'3.1.0','Use OpenAPI 3.1');
assert.ok(spec.info?.title && spec.info?.version);
assert.ok(Object.keys(spec.paths??{}).length>0,'No API paths declared');
assert.ok(spec.servers?.every(s=>s.url.includes('.invalid')),'Draft server must not claim a real deployment');
const schemaNames=new Set(Object.keys(spec.components?.schemas??{}));
let operations=0,refs=0;
function walk(obj){if(Array.isArray(obj)){for(const x of obj)walk(x);return}
 if(!obj || typeof obj!=='object')return;
 if(typeof obj.$ref==='string'){
  refs++;
  const prefix='#/components/schemas/';
  assert.ok(obj.$ref.startsWith(prefix),`Unsupported reference: ${obj.$ref}`);
  assert.ok(schemaNames.has(obj.$ref.slice(prefix.length)),`Unresolved schema: ${obj.$ref}`);
 }
 for(const [key,v] of Object.entries(obj)){if(key!=='$ref')walk(v)}
}
for(const [path,methods] of Object.entries(spec.paths)){
 assert.ok(path.startsWith('/v1/'),`Versionless API path: ${path}`);
 for(const [method,op] of Object.entries(methods)){
  assert.ok(['get','post','patch','put','delete'].includes(method),`Invalid method ${method}`);
  assert.ok(op.summary && op.responses && Object.keys(op.responses).length>0,`Incomplete operation ${method} ${path}`);
  operations++;
 }
}
walk(spec);
console.log(`OpenAPI draft structural checks passed: ${operations} operations, ${schemaNames.size} schemas, ${refs} resolved schema references. Full OpenAPI 3.1 validation pending.`);
