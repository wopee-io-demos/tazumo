#!/usr/bin/env node
// Independent fail-closed gate after a contract walk: exits 0 only when report.json and the saved UiAutomator trees
// prove every native contract ID resolved and every checkout control is disabled.
// Usage: node --experimental-strip-types verify-contract-walk.mjs <contracts/sut.json> <outDir>
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadCore,verifyWalk} from './contract-walk.mjs';

const [contractPath,outDir]=process.argv.slice(2);
if(!contractPath||!outDir){console.error('usage: verify-contract-walk.mjs <contracts/sut.json> <outDir>');process.exit(2)}
let report;
try{report=JSON.parse(readFileSync(join(outDir,'report.json'),'utf8'))}catch{report=undefined}
const result=verifyWalk(JSON.parse(readFileSync(contractPath,'utf8')),await loadCore(),report,outDir);
console.log(`verify ${join(outDir,'report.json')}: ${result.ok?'OK':'FAIL'} :: ${result.reason}`);
process.exit(result.ok?0:1);
