import {existsSync,readFileSync} from 'node:fs';
const required=['AGENTS.md','openspec/config.yaml','docs/adr/README.md','openspec/changes/marketplace-foundation/proposal.md','openspec/changes/marketplace-foundation/design.md','openspec/changes/marketplace-foundation/tasks.md','apps/mobile/app.json','apps/web/package.json','packages/core/src/index.ts','packages/brand/src/index.ts'];
for(const f of required)if(!existsSync(f)){console.error('Missing architecture file:',f);process.exitCode=1}
const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts;
for(const name of ['typecheck','test','build','bundle:mobile','test:e2e'])if(!scripts[name]){console.error('Missing CI script:',name);process.exitCode=1}
if(!process.exitCode)console.log('Repository architecture and quality scripts verified.');
