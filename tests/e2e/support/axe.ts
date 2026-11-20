import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type {Page,TestInfo} from '@playwright/test';

export const wcagTags=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
export const blockingImpacts=['serious','critical'];

export type BaselineEntry={scan:string;rule:string;impact:'serious'|'critical';nodes:number;issue:string;reason:string};
export const baseline:{entries:BaselineEntry[]}=JSON.parse(readFileSync(join(__dirname,'..','a11y-baseline.json'),'utf8'));

type Violation={id:string;impact?:string|null;help:string;nodes:{target:unknown[]}[]};

export function gate(scan:string,violations:Violation[]){
  const blocking=violations.filter(v=>blockingImpacts.includes(v.impact??''));
  const allowed=baseline.entries.filter(e=>e.scan===scan);
  const unexpected=blocking
    .filter(v=>{const entry=allowed.find(e=>e.rule===v.id);return !entry||entry.impact!==v.impact||v.nodes.length!==entry.nodes;})
    .map(v=>({rule:v.id,impact:v.impact,nodes:v.nodes.length,help:v.help,targets:v.nodes.map(n=>n.target.join(' '))}));
  const stale=allowed.filter(e=>!blocking.some(v=>v.id===e.rule)).map(e=>`${e.scan}:${e.rule}`);
  return {unexpected,stale,baselined:blocking.length-unexpected.length};
}

export async function scan(page:Page,testInfo:TestInfo,name:string){
  const results=await new AxeBuilder({page}).withTags(wcagTags).analyze();
  await testInfo.attach(`axe-${name}.json`,{body:JSON.stringify(results.violations,null,2),contentType:'application/json'});
  await testInfo.attach(`${name}.png`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  const result=gate(name,results.violations);
  if(result.baselined)testInfo.annotations.push({type:'a11y-baseline',description:`${result.baselined} known serious/critical rule(s) accepted by the baseline in ${name}`});
  return result;
}
