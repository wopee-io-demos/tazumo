#!/usr/bin/env bash
# Usage: provenance.sh <out.json> <platform> <device> <os> <build>
set -euo pipefail
node - "$@" <<'JS'
const [out,platform,device,os,build]=process.argv.slice(2);
const {execSync}=require('node:child_process');
const sh=c=>execSync(c,{encoding:'utf8'}).trim();
const env=process.env;
const {createHash}=require('node:crypto');
const {readdirSync,readFileSync}=require('node:fs');
const dir=require('node:path').dirname(out);
const pngSha256=Object.fromEntries(readdirSync(dir).filter(f=>f.endsWith('.png')).sort().map(f=>[f,createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex')]));
const pkg=n=>JSON.parse(readFileSync(require.resolve(`${n}/package.json`,{paths:['apps/mobile']}),'utf8')).version;
const run=env.GITHUB_RUN_ID?`${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`:'local';
require('node:fs').writeFileSync(out,JSON.stringify({
  platform,
  sutCommit:sh('git log -1 --format=%H -- apps/mobile packages package.json pnpm-workspace.yaml'),
  captureCommit:sh("git rev-parse HEAD"),
  workflowRun:run,
  runner:`${env.RUNNER_OS??''} ${env.ImageOS??''} ${env.ImageVersion??''}`.trim(),
  device,os,build,
  resolved:{expo:pkg('expo'),reactNative:pkg('react-native')},
  pngSha256,
  fixtureData:'packages/core/src/index.ts products (synthetic, illustrative); cart = 2x Margherita pizza, 1x Sourdough loaf, 1x Fresh flowers',
  optimiser:`pngquant ${sh('pngquant --version')}`,
  driver:`Maestro ${sh('maestro --version 2>/dev/null | tail -1')} for taps; screenshots taken by the platform tool`,
  capturedAt:new Date().toISOString().replace(/\.\d+Z$/,'Z')
},null,2)+'\n');
JS
