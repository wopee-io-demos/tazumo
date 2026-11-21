/** Build identity of the Tazumo SUT: product version, source commit, build time and contract versions.
 * Served by the web build as version.json and <meta name="tazumo-version">; see docs/RELEASING.md. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const repoRoot=fileURLToPath(new URL('..',import.meta.url));
const fullSha=/^[0-9a-f]{40}$/;

/** TAZUMO_COMMIT, then GITHUB_SHA, then `git rev-parse HEAD`; "unknown" when none yields a full SHA. */
export function resolveCommit(env=process.env,cwd=repoRoot){
  const given=env.TAZUMO_COMMIT||env.GITHUB_SHA;
  if(given)return fullSha.test(given)?given:'unknown';
  try{
    const head=execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    return fullSha.test(head)?head:'unknown';
  }catch{return 'unknown'}
}

export function buildInfo({root=repoRoot,env=process.env,now=new Date()}={}){
  const json=path=>JSON.parse(readFileSync(join(root,path),'utf8'));
  return {
    version:json('package.json').version,
    commit:resolveCommit(env,root),
    builtAt:now.toISOString(),
    contracts:{sut:json('contracts/sut.json').version,openapi:json('contracts/openapi.json').info.version}
  };
}
