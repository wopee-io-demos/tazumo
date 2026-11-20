/** Pure validation of contracts/sut.json against app sources, fixtures and a previously published contract. */
export const ID_PATTERN=/^sut-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALUE='[a-z0-9]+(?:-[a-z0-9]+)*';
const PLATFORMS=['web','native'];
const PROSE=[/^journeys\.[^.]+\.steps\./,/^isolation$/,/^repo$/];

const webId=selector=>/^\[data-testid="([^"]+)"\]$/.exec(selector)?.[1];
const toId=(platform,selector)=>platform==='web'?webId(selector):selector;
const placeholders=template=>[...template.matchAll(/\{([a-zA-Z]+)\}/g)].map(m=>m[1]);
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function domains(core){
  const lower=xs=>xs.map(x=>String(x).toLowerCase());
  return {
    productId:core.products.map(p=>p.id),
    merchantId:core.merchants.map(m=>m.id),
    category:['all',...lower(core.categories)],
    language:[...core.languages]
  };
}

/** Locate every construct that yields a test ID: quoted literals, template literals, and string props spliced into templates.
 * Props are gathered across all texts first, because a component and its call sites live in different files. */
export function idSites(texts){
  const props=new Map(),sites=[];
  for(const text of texts)for(const m of text.matchAll(/\b([a-zA-Z]+)="(sut-[a-z0-9-]+)"/g)){
    if(m[1]==='testID'||m[1]==='testid')continue;
    props.set(m[1],[...(props.get(m[1])??[]),m[2]]);
  }
  const direct=new Set(texts.flatMap(text=>[...text.matchAll(/(?:data-testid|testID)=\{([a-zA-Z]+)\}/g)].map(m=>m[1])));
  const spliced=new Set([...props].filter(([name])=>!direct.has(name)).flatMap(([,values])=>values));
  texts.forEach((text,file)=>{
    for(const m of text.matchAll(/(?<!\^=)(["'`])(sut-[a-z0-9-]+)\1/g))
      if(!spliced.has(m[2]))sites.push({file,start:m.index,end:m.index+m[0].length,literals:[m[2]],templates:[]});
    for(const m of text.matchAll(/`([^`]*)`/g)){
      const raw=m[1],head=/^\$\{([a-zA-Z]+)\}/.exec(raw);
      const starts=head&&props.has(head[1])?props.get(head[1]).map(p=>p+raw.slice(head[0].length)):[raw];
      const templates=starts.filter(x=>x.startsWith('sut-')&&x.includes('${')).map(x=>x.replace(/\$\{[^}]*\}/g,'{}'));
      if(templates.length)sites.push({file,start:m.index,end:m.index+m[0].length,literals:[],templates});
    }
  });
  return sites;
}

export function extractIds(texts){
  const literals=new Set(),templates=new Set();
  for(const site of idSites(Array.isArray(texts)?texts:[texts])){
    site.literals.forEach(x=>literals.add(x));
    site.templates.forEach(x=>templates.add(x));
  }
  return {literals,templates};
}

export const mergeIds=sources=>extractIds(sources.map(s=>s.text));

const normalize=id=>id.replace(/\{[a-zA-Z]+\}/g,'{}');

/** Whether a set of literals and templates produces a concrete ID (placeholders filled from fixture values) or a template. */
export function yields(found,id,values){
  if(id.includes('{'))return found.templates.has(normalize(id));
  if(found.literals.has(id))return true;
  for(const template of found.templates){
    const m=new RegExp('^'+template.split('{}').map(escape).join('('+VALUE+')')+'$').exec(id);
    if(m&&m.slice(1).every(v=>values.has(v)))return true;
  }
  return false;
}

/** Every contract selector and template as {platform,group,key,id}. */
export function contractIds(contract){
  return PLATFORMS.flatMap(platform=>['selectors','selectorTemplates'].flatMap(group=>
    Object.entries(contract[platform]?.[group]??{}).map(([key,selector])=>({platform,group,key,id:toId(platform,selector)}))));
}

/** Every contract selector and template must exist in that platform's sources. */
export function checkSelectors(contract,sources,core){
  const errors=[],dom=domains(core),values=new Set(Object.values(dom).flat());
  for(const platform of PLATFORMS){
    const section=contract[platform]??{},found=mergeIds(sources[platform]??[]);
    const seen=new Map();
    for(const [key,selector] of Object.entries(section.selectors??{})){
      const id=toId(platform,selector);
      if(!id||!ID_PATTERN.test(id)){errors.push(`${platform}.selectors.${key}: not a stable sut-* test ID (${selector})`);continue}
      if(seen.has(id))errors.push(`${platform}.selectors.${key}: duplicates ${seen.get(id)} (${id})`);
      seen.set(id,key);
      if(!yields(found,id,values))errors.push(`${platform}.selectors.${key}: ${id} not found in ${platform} sources`);
    }
    for(const [key,selector] of Object.entries(section.selectorTemplates??{})){
      const id=toId(platform,selector);
      const names=id?placeholders(id):[];
      if(!id||names.length===0||!ID_PATTERN.test(id.replace(/\{[a-zA-Z]+\}/g,'x'))){errors.push(`${platform}.selectorTemplates.${key}: not a sut-* template with a {placeholder} (${selector})`);continue}
      for(const name of names)if(!dom[name])errors.push(`${platform}.selectorTemplates.${key}: unknown placeholder {${name}}`);
      if(!yields(found,id,values))errors.push(`${platform}.selectorTemplates.${key}: ${id} not found in ${platform} sources`);
    }
  }
  return errors;
}

export function checkRoutes(contract,sources,core){
  const errors=[],dom=domains(core),web=(sources.web??[]).map(s=>s.text).join('\n');
  for(const [key,route] of Object.entries(contract.web?.routes??{})){
    if(!route.startsWith('#/'))errors.push(`web.routes.${key}: must be a hash route (${route})`);
    for(const name of placeholders(route))if(!dom[name])errors.push(`web.routes.${key}: unknown placeholder {${name}}`);
    if(!web.includes(route.split('{')[0]))errors.push(`web.routes.${key}: ${route} not found in web sources`);
  }
  return errors;
}

export function checkFixtures(contract,core){
  const errors=[];
  for(const entry of contract.fixtures?.products??[]){
    const p=core.products.find(x=>x.id===entry.id);
    if(!p){errors.push(`fixtures.products: ${entry.id} missing from @tazumo/core`);continue}
    if(p.name!==entry.name)errors.push(`fixtures.products.${entry.id}.name: core has "${p.name}"`);
    if(p.priceCents!==entry.priceMinor)errors.push(`fixtures.products.${entry.id}.priceMinor: core has ${p.priceCents}`);
    if(entry.merchant&&p.merchant!==entry.merchant)errors.push(`fixtures.products.${entry.id}.merchant: core has "${p.merchant}"`);
    if(entry.merchantId&&!core.merchants.some(m=>m.id===entry.merchantId&&m.name===p.merchant))errors.push(`fixtures.products.${entry.id}.merchantId: ${entry.merchantId} does not sell it`);
  }
  for(const entry of contract.fixtures?.merchants??[]){
    const m=core.merchants.find(x=>x.id===entry.id);
    if(!m)errors.push(`fixtures.merchants: ${entry.id} missing from @tazumo/core`);
    else if(m.name!==entry.name)errors.push(`fixtures.merchants.${entry.id}.name: core has "${m.name}"`);
  }
  return errors;
}

const SEMVER=/^(\d+)\.(\d+)\.(\d+)$/;
export const parseVersion=v=>{const m=SEMVER.exec(v??'');return m?m.slice(1).map(Number):null};

/** Flatten to leaf paths; arrays of objects with an id are keyed by that id so reordering is not a change. */
export function flatten(value,prefix='',out=new Map()){
  if(Array.isArray(value)){
    value.forEach((item,i)=>flatten(item,`${prefix}.${item&&typeof item==='object'&&'id' in item?item.id:i}`,out));
  }else if(value&&typeof value==='object'){
    for(const [k,v] of Object.entries(value))flatten(v,prefix?`${prefix}.${k}`:k,out);
  }else out.set(prefix,value);
  return out;
}

/** Classify the change from a published contract and require the matching semantic version bump. */
export function checkCompatibility(base,next){
  if(!base)return {level:'initial',errors:[]};
  const strip=c=>{const {version,...rest}=c;return flatten(rest)};
  const before=strip(base),after=strip(next);
  const prose=path=>PROSE.some(re=>re.test(path));
  const removed=[],changed=[],added=[],edited=[];
  for(const [path,v] of before){
    if(!after.has(path))(prose(path)?edited:removed).push(path);
    else if(after.get(path)!==v)(prose(path)?edited:changed).push(path);
  }
  for(const path of after.keys())if(!before.has(path))(prose(path)?edited:added).push(path);
  const level=removed.length||changed.length?'major':added.length?'minor':edited.length?'patch':'none';
  const errors=[],a=parseVersion(base.version),b=parseVersion(next.version);
  if(!b)return {level,errors:[`version "${next.version}" is not MAJOR.MINOR.PATCH`],removed,changed,added};
  if(!a)return {level,errors:[],removed,changed,added};
  const cmp=(x,y)=>x[0]-y[0]||x[1]-y[1]||x[2]-y[2];
  const need={major:[a[0]+1,0,0],minor:[a[0],a[1]+1,0],patch:[a[0],a[1],a[2]+1],none:a}[level];
  if(cmp(b,need)<0){
    const detail=[...removed.map(p=>`removed ${p}`),...changed.map(p=>`changed ${p}`),...added.map(p=>`added ${p}`)].slice(0,8).join('; ');
    errors.push(`${level} change from v${base.version} requires version >= ${need.join('.')}, found ${next.version}${detail?` (${detail})`:''}`);
  }
  if(level!=='major'&&b[0]!==a[0])errors.push(`major bump to ${next.version} without a breaking change`);
  return {level,errors,removed,changed,added};
}

/** Test IDs present in sources but not registered in the contract (informational). */
export function unregistered(contract,sources,core){
  const out={},dom=domains(core);
  for(const platform of PLATFORMS){
    const section=contract[platform]??{},found=mergeIds(sources[platform]??[]);
    const ids=new Set(Object.values(section.selectors??{}).map(s=>toId(platform,s)));
    const templates=new Set(Object.values(section.selectorTemplates??{}).map(s=>toId(platform,s).replace(/\{[a-zA-Z]+\}/g,'{}')));
    const covered=id=>ids.has(id)||[...templates].some(t=>new RegExp('^'+t.split('{}').map(escape).join('('+Object.values(dom).flat().map(escape).join('|')+')')+'$').test(id));
    out[platform]=[...[...found.literals].filter(id=>!covered(id)),...[...found.templates].filter(t=>!templates.has(t))].sort();
  }
  return out;
}
