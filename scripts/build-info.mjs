/** Build identity of the Tazumo SUT: product version, source commit, build time and contract versions.
 * Served by the web build as version.json and <meta name="tazumo-version">; see docs/RELEASING.md. */
import {execFileSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const repoRoot=fileURLToPath(new URL('..',import.meta.url));
export const repository='wopee-io-demos/tazumo';
const fullSha=/^[0-9a-f]{40}$/;

function gitHead(cwd){
  try{
    const git=args=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    return realpathSync(git(['rev-parse','--show-toplevel']))===realpathSync(cwd)?git(['rev-parse','HEAD']):'';
  }catch{return ''}
}

/** TAZUMO_COMMIT, then the HEAD of this checkout (not of an enclosing repository), then GITHUB_SHA when the
 * workflow runs in the Tazumo repository itself; "unknown" when none is a full SHA. */
export function resolveCommit(env=process.env,cwd=repoRoot){
  const candidates=[env.TAZUMO_COMMIT,gitHead(cwd),env.GITHUB_REPOSITORY===repository?env.GITHUB_SHA:undefined];
  return candidates.find(c=>c&&fullSha.test(c))??'unknown';
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
