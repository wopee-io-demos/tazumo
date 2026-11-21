/** Pure validation of contracts/sut.json against app sources, fixtures and a previously published contract. */
import ts from 'typescript';

export const ID_PATTERN=/^sut-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TEST_ID_ATTRIBUTE={web:'data-testid',native:'testID'};
const VALUE='[a-z0-9]+(?:-[a-z0-9]+)*';
const PLATFORMS=['web','native'];
const PROSE=[/^journeys\.[^.]+\.steps\./,/^isolation$/,/^repo$/];

const webId=selector=>/^\[data-testid="([^"]+)"\]$/.exec(selector)?.[1];
const toId=(platform,selector)=>platform==='web'?webId(selector):selector;
const placeholders=template=>[...template.matchAll(/\{([a-zA-Z]+)\}/g)].map(m=>m[1]);
const normalize=id=>id.replace(/\{[a-zA-Z]+\}/g,'{}');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templateRegex=template=>new RegExp('^'+template.split('{}').map(escape).join('('+VALUE+')')+'$');

export function domains(core){
  return {
    productId:core.products.map(p=>p.id),
    merchantId:core.merchants.map(m=>m.id),
    category:['all',...core.categories.map(c=>c.toLowerCase())],
    language:[...core.languages]
  };
}

const parse=source=>ts.createSourceFile(source.path,source.text,ts.ScriptTarget.Latest,true,source.path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const walk=(node,visit)=>{visit(node);ts.forEachChild(node,child=>walk(child,visit))};
const attrName=attr=>attr.name.getText();

/** Find every JSX test-ID attribute of the platform (data-testid on web, testID on native) and resolve its value.
 * Values may be string literals, template literals, a conditional or ?? of those, or a prop of the enclosing component
 * whose string values are taken from JSX call sites of that component (<Component prop="sut-...">). Comments and other attributes are ignored. */
export function idSites(sources,platform){
  const attribute=TEST_ID_ATTRIBUTE[platform],files=sources.map(parse),props=new Map(),sites=[];
  for(const file of files)walk(file,node=>{
    if(ts.isJsxAttribute(node)&&node.initializer&&ts.isStringLiteral(node.initializer)&&attrName(node)!==attribute){
      const key=`${node.parent.parent.tagName.getText()}.${attrName(node)}`;
      props.set(key,[...(props.get(key)??[]),node.initializer.text]);
    }
  });
  const componentOf=node=>{
    for(let n=node.parent;n;n=n.parent){
      if(ts.isFunctionDeclaration(n)&&n.name)return n.name.text;
      if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))return n.name.text;
    }
    return '';
  };
  let component='';
  const prop=name=>props.get(`${component}.${name}`);
  const resolve=expr=>{
    if(!expr)return [];
    if(ts.isStringLiteral(expr)||ts.isNoSubstitutionTemplateLiteral(expr))return [expr.text];
    if(ts.isParenthesizedExpression(expr))return resolve(expr.expression);
    if(ts.isConditionalExpression(expr))return [...resolve(expr.whenTrue),...resolve(expr.whenFalse)];
    if(ts.isBinaryExpression(expr)&&[ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.BarBarToken].includes(expr.operatorToken.kind))return [...resolve(expr.left),...resolve(expr.right)];
    if(ts.isIdentifier(expr))return prop(expr.text)??[];
    if(ts.isTemplateExpression(expr)){
      const [first,...rest]=expr.templateSpans;
      const tail=spans=>spans.map(s=>'{}'+s.literal.text).join('');
      if(expr.head.text===''&&ts.isIdentifier(first.expression)&&prop(first.expression.text))
        return prop(first.expression.text).map(p=>p+first.literal.text+tail(rest));
      return [expr.head.text+tail(expr.templateSpans)];
    }
    return [];
  };
  files.forEach((file,index)=>walk(file,node=>{
    if(!ts.isJsxAttribute(node)||attrName(node)!==attribute||!node.initializer)return;
    component=componentOf(node);
    const values=resolve(ts.isJsxExpression(node.initializer)?node.initializer.expression:node.initializer).filter(v=>v.startsWith('sut-'));
    if(!values.length)return;
    const element=node.parent.parent;
    const disabledAttr=element.attributes.properties.find(a=>ts.isJsxAttribute(a)&&attrName(a)==='disabled');
    const disabled=!!disabledAttr&&(!disabledAttr.initializer||(ts.isJsxExpression(disabledAttr.initializer)&&disabledAttr.initializer.expression?.kind===ts.SyntaxKind.TrueKeyword));
    sites.push({file:index,start:node.getStart(file),end:node.getEnd(),
      literals:values.filter(v=>!v.includes('{}')),templates:values.filter(v=>v.includes('{}')),disabled});
  }));
  return sites;
}

export function extractIds(sources,platform){
  const literals=new Set(),templates=new Set();
  for(const site of idSites(sources,platform)){
    site.literals.forEach(x=>literals.add(x));
    site.templates.forEach(x=>templates.add(x));
  }
  return {literals,templates};
}

/** String literal and template-head texts in the sources (comments excluded). */
export function stringsIn(sources){
  const out=new Set();
  for(const file of sources.map(parse))walk(file,node=>{
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node))out.add(node.text);
  });
  return out;
}

/** Whether found literals and templates produce a contract template, or a concrete ID whose placeholder values
 * belong to the domain the contract declares for that template (any fixture domain when undeclared). */
export function yields(found,id,dom,typed=new Map()){
  if(id.includes('{'))return found.templates.has(normalize(id));
  if(found.literals.has(id))return true;
  const any=Object.values(dom).flat();
  for(const template of found.templates){
    const m=templateRegex(template).exec(id);
    if(!m)continue;
    const names=typed.get(template);
    if(m.slice(1).every((v,i)=>(names?dom[names[i]]??[]:any).includes(v)))return true;
  }
  return false;
}

/** Every contract selector and template as {platform,group,key,id}. */
export function contractIds(contract){
  return PLATFORMS.flatMap(platform=>['selectors','selectorTemplates'].flatMap(group=>
    Object.entries(contract[platform]?.[group]??{}).map(([key,selector])=>({platform,group,key,id:toId(platform,selector)}))));
}

/** Every contract selector and template must exist as a test-ID attribute in that platform's sources. */
export function checkSelectors(contract,sources,core){
  const errors=[],dom=domains(core);
  for(const platform of PLATFORMS){
    const section=contract[platform]??{},found=extractIds(sources[platform]??[],platform);
    const typed=new Map(Object.values(section.selectorTemplates??{}).map(s=>toId(platform,s)).filter(Boolean).map(id=>[normalize(id),placeholders(id)]));
    const seen=new Map();
    for(const [key,selector] of Object.entries(section.selectors??{})){
      const id=toId(platform,selector);
      if(!id||!ID_PATTERN.test(id)){errors.push(`${platform}.selectors.${key}: not a stable sut-* test ID (${selector})`);continue}
      if(seen.has(id))errors.push(`${platform}.selectors.${key}: duplicates ${seen.get(id)} (${id})`);
      seen.set(id,key);
      if(!yields(found,id,dom,typed))errors.push(`${platform}.selectors.${key}: ${id} not found in ${platform} sources`);
    }
    for(const [key,selector] of Object.entries(section.selectorTemplates??{})){
      const id=toId(platform,selector);
      const names=id?placeholders(id):[];
      if(!id||names.length===0||!ID_PATTERN.test(id.replace(/\{[a-zA-Z]+\}/g,'x'))){errors.push(`${platform}.selectorTemplates.${key}: not a sut-* template with a {placeholder} (${selector})`);continue}
      for(const name of names)if(!dom[name])errors.push(`${platform}.selectorTemplates.${key}: unknown placeholder {${name}}`);
      if(!yields(found,id,dom))errors.push(`${platform}.selectorTemplates.${key}: ${id} not found in ${platform} sources`);
    }
  }
  return errors;
}

/** Controls that must be genuinely disabled (disabled attribute without a false value on the same element). */
export function checkDisabled(sources,platform,ids){
  const sites=idSites(sources,platform);
  return ids.filter(id=>!sites.some(s=>s.literals.includes(id)&&s.disabled)).map(id=>`${platform} ${id} must be a genuinely disabled control`);
}

export function checkRoutes(contract,sources,core){
  const errors=[],dom=domains(core),strings=[...stringsIn(sources.web??[])];
  for(const [key,route] of Object.entries(contract.web?.routes??{})){
    if(!route.startsWith('#/'))errors.push(`web.routes.${key}: must be a hash route (${route})`);
    for(const name of placeholders(route))if(!dom[name])errors.push(`web.routes.${key}: unknown placeholder {${name}}`);
    const head=route.split('{')[0];
    if(!strings.some(s=>head===route?s===route:s.startsWith(head)))errors.push(`web.routes.${key}: ${route} not found in web sources`);
  }
  return errors;
}

export function checkFixtures(contract,core){
  const errors=[];
  const unique=(list,name)=>{const ids=list.map(x=>x.id);for(const id of new Set(ids.filter((x,i)=>ids.indexOf(x)!==i)))errors.push(`${name}: duplicate id ${id}`)};
  unique(contract.fixtures?.products??[],'fixtures.products');
  unique(contract.fixtures?.merchants??[],'fixtures.merchants');
  unique(contract.journeys??[],'journeys');
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

/** Flatten to leaf paths. Arrays of objects with an id are keyed by that id and arrays of primitives by value,
 * so reordering is not a change; empty containers are leaves of their own. */
export function flatten(value,prefix='',out=new Map()){
  if(Array.isArray(value)){
    if(!value.length)out.set(prefix,'[]');
    else if(value.every(item=>item===null||typeof item!=='object')&&!/\.steps$/.test(prefix))for(const item of value)out.set(`${prefix}[${JSON.stringify(item)}]`,true);
    else value.forEach((item,i)=>flatten(item,`${prefix}.${item&&typeof item==='object'&&'id' in item?item.id:i}`,out));
  }else if(value&&typeof value==='object'){
    const entries=Object.entries(value);
    if(!entries.length)out.set(prefix,'{}');
    for(const [k,v] of entries)flatten(v,prefix?`${prefix}.${k}`:k,out);
  }else out.set(prefix,value);
  return out;
}

/** Classify the change from a published contract and require exactly the matching semantic version.
 * Breaking changes always need a major bump, also below 1.0.0. */
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
  const filled=path=>['{}','[]'].includes(before.get(path))&&[...after.keys()].some(p=>p.startsWith(path+'.')||p.startsWith(path+'['));
  for(let i=removed.length-1;i>=0;i--)if(filled(removed[i]))removed.splice(i,1);
  const level=removed.length||changed.length?'major':added.length?'minor':edited.length?'patch':'none';
  const a=parseVersion(base.version),b=parseVersion(next.version);
  if(!b)return {level,errors:[`version "${next.version}" is not MAJOR.MINOR.PATCH`],removed,changed,added};
  if(!a)return {level,errors:[],removed,changed,added};
  const need={major:[a[0]+1,0,0],minor:[a[0],a[1]+1,0],patch:[a[0],a[1],a[2]+1],none:a}[level];
  const errors=[];
  if(need.join('.')!==b.join('.')){
    const detail=[...removed.map(p=>`removed ${p}`),...changed.map(p=>`changed ${p}`),...added.map(p=>`added ${p}`)].slice(0,8).join('; ');
    errors.push(`${level} change from v${base.version} requires version ${need.join('.')}, found ${next.version}${detail?` (${detail})`:''}`);
  }
  return {level,errors,removed,changed,added};
}

/** Test IDs present in sources but not registered in the contract (informational). */
export function unregistered(contract,sources,core){
  const out={},any=Object.values(domains(core)).flat();
  for(const platform of PLATFORMS){
    const section=contract[platform]??{},found=extractIds(sources[platform]??[],platform);
    const ids=new Set(Object.values(section.selectors??{}).map(s=>toId(platform,s)));
    const templates=new Set(Object.values(section.selectorTemplates??{}).map(s=>normalize(toId(platform,s))));
    const covered=id=>ids.has(id)||[...templates].some(t=>{const m=templateRegex(t).exec(id);return m&&m.slice(1).every(v=>any.includes(v))});
    out[platform]=[...[...found.literals].filter(id=>!covered(id)),...[...found.templates].filter(t=>!templates.has(t))].sort();
  }
  return out;
}
