/** contracts/openapi.json info.version must be semver and must increase whenever the contract changes.
 * Usage: node scripts/check-openapi-version.mjs [--base <git-ref>] */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const path='contracts/openapi.json';
const root=fileURLToPath(new URL('..',import.meta.url));
export const semver=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Semver precedence: negative, zero or positive. Build metadata is ignored. */
export function compareSemver(a,b){
  const [,...x]=semver.exec(a),[,...y]=semver.exec(b);
  const sign=(m,n)=>(BigInt(m)>BigInt(n))-(BigInt(m)<BigInt(n));
  for(let i=0;i<3;i++)if(sign(x[i],y[i]))return sign(x[i],y[i]);
  if(!x[3]||!y[3])return x[3]?-1:y[3]?1:0;
  const p=x[3].split('.'),q=y[3].split('.');
  for(let i=0;i<Math.max(p.length,q.length);i++){
    if(p[i]===undefined)return -1;
    if(q[i]===undefined)return 1;
    const m=/^\d+$/.test(p[i]),n=/^\d+$/.test(q[i]);
    if(m&&n&&sign(p[i],q[i]))return sign(p[i],q[i]);
    if(m!==n)return m?-1:1;
    if(p[i]!==q[i])return p[i]<q[i]?-1:1;
  }
  return 0;
}

const withoutVersion=spec=>JSON.stringify({...spec,info:{...spec.info,version:undefined}});

export function checkOpenapiVersion(base,next){
  const version=next?.info?.version;
  if(typeof version!=='string'||!semver.test(version))return [`${path} info.version "${version}" is not a semantic version`];
  if(!base)return [];
  const before=base.info?.version;
  if(withoutVersion(base)!==withoutVersion(next)&&version===before)return [`${path} changed but info.version is still ${before}: bump it (additive change: next minor)`];
  if(typeof before==='string'&&semver.test(before)&&version!==before&&compareSemver(version,before)<=0)return [`${path} info.version ${version} must be greater than ${before}`];
  return [];
}

function baseSpec(ref){
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  try{git(['rev-parse','--verify','--quiet',`${ref}^{commit}`])}catch{throw new Error(`--base ${ref} is not a commit`)}
  try{git(['cat-file','-e',`${ref}:${path}`])}catch{return null}
  return JSON.parse(git(['show',`${ref}:${path}`]));
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length&&(args[0]!=='--base'||!args[1]||args.length>2))throw new Error('Usage: check-openapi-version.mjs [--base <git-ref>]');
  const next=JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
  const base=args[1]?baseSpec(args[1]):null;
  const errors=checkOpenapiVersion(base,next);
  if(errors.length){for(const e of errors)console.error(e);process.exit(1)}
  console.log(base?`OpenAPI ${next.info.version} (base ${base.info.version}): version check passed.`:`OpenAPI ${next.info.version}: semantic version.`);
}
