#!/usr/bin/env node
// Cache key for the persistent iOS build cache on the self-hosted mac-ios runner.
// It changes when anything that shapes the native iOS build changes: the Xcode version, the Expo native layer
// (app.json, package.json, config plugins), the workspace install settings, or the version of any installed
// package that ships a CocoaPods podspec. JavaScript-only package changes do not change it.
// Usage: XCODE_VERSION="$(xcodebuild -version)" node ios-cache-key.mjs [mobileDir]
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,realpathSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

function walk(dir,visit,depth=0,max=8){
  let entries;
  try{entries=readdirSync(dir,{withFileTypes:true})}catch{return}
  for(const e of entries){
    const p=join(dir,e.name);
    if(e.isDirectory()){if(e.name!=='.git'&&depth<max)walk(p,visit,depth+1,max)}
    else visit(p);
  }
}

function nativePackages(nodeModules){
  const found=new Set();
  walk(nodeModules,(file)=>{
    if(!file.endsWith('.podspec'))return;
    for(let dir=dirname(file);dir.startsWith(nodeModules)&&dir!==nodeModules;dir=dirname(dir)){
      const pkg=join(dir,'package.json');
      if(existsSync(pkg)){
        try{const {name,version}=JSON.parse(readFileSync(pkg,'utf8'));if(name&&version){found.add(`${name}@${version}`);return}}catch{}
      }
    }
  });
  return [...found].sort();
}

export function cacheInputs(mobileDir,xcodeVersion){
  const root=resolve(mobileDir,'..','..');
  const files=['app.json','package.json','eas.json'].map(f=>join(mobileDir,f));
  const plugins=join(mobileDir,'plugins');
  if(existsSync(plugins))walk(plugins,(f)=>files.push(f));
  files.push(join(root,'pnpm-workspace.yaml'),join(root,'.npmrc'));
  const rootPkg=existsSync(join(root,'package.json'))?JSON.parse(readFileSync(join(root,'package.json'),'utf8')):{};
  return {
    xcode:String(xcodeVersion??'').trim(),
    files:files.filter(f=>existsSync(f)&&statSync(f).isFile()).sort().map(f=>[relative(root,f),createHash('sha256').update(readFileSync(f)).digest('hex')]),
    overrides:rootPkg.pnpm?.overrides??{},
    nativePackages:nativePackages(join(root,'node_modules'))
  };
}

export function cacheKey(mobileDir,xcodeVersion){
  if(!String(xcodeVersion??'').trim())throw new Error('XCODE_VERSION is required');
  return createHash('sha256').update(JSON.stringify(cacheInputs(mobileDir,xcodeVersion))).digest('hex').slice(0,20);
}

if(process.argv[1]&&realpathSync(fileURLToPath(import.meta.url))===realpathSync(process.argv[1])){
  console.log(cacheKey(resolve(process.argv[2]??join(dirname(fileURLToPath(import.meta.url)),'..')),process.env.XCODE_VERSION));
}
