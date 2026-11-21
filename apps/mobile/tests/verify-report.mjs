#!/usr/bin/env node
// Independent fail-closed gate after a case run: exits 0 only when report.json proves the expected result.
// Usage: node verify-report.mjs <case.json> <outDir> [--expect-fail]
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {verdict} from './run-case.mjs';

const args=process.argv.slice(2),[casePath,outDir]=args.filter(a=>!a.startsWith('--')),expectFail=args.includes('--expect-fail');
if(!casePath||!outDir){console.error('usage: verify-report.mjs <case.json> <outDir> [--expect-fail]');process.exit(2)}
let report;
try{report=JSON.parse(readFileSync(join(outDir,'report.json'),'utf8'))}catch{report=undefined}
const result=verdict(JSON.parse(readFileSync(casePath,'utf8')),report,expectFail);
console.log(`verify ${join(outDir,'report.json')}: ${result.ok?'OK':'FAIL'} :: ${result.reason}`);
process.exit(result.ok?0:1);
