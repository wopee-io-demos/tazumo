import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root=join(__dirname,'..','..');
const json=(path:string)=>JSON.parse(readFileSync(join(root,path),'utf8'));
const version=json('package.json').version;
const contracts={sut:json('contracts/sut.json').version,openapi:json('contracts/openapi.json').info.version};

test('the production build ships version.json and version meta tags',()=>{
  test.setTimeout(120_000);
  const out=mkdtempSync(join(tmpdir(),'tazumo-version-'));
  const commit='0123456789abcdef0123456789abcdef01234567';
  try{
    execFileSync('pnpm',['--filter','@tazumo/web','exec','vite','build','--outDir',out,'--emptyOutDir','--logLevel','error'],
      {stdio:'inherit',timeout:110_000,env:{...process.env,TAZUMO_COMMIT:commit,TAZUMO_WEB_BASE:'/tazumo/'}});
    const info=JSON.parse(readFileSync(join(out,'version.json'),'utf8'));
    expect(info).toEqual({version,commit,builtAt:expect.any(String),contracts});
    expect(Date.now()-Date.parse(info.builtAt)).toBeLessThan(120_000);
    const html=readFileSync(join(out,'index.html'),'utf8');
    expect(html).toContain(`<meta name="tazumo-version" content="${version}">`);
    expect(html).toContain(`<meta name="tazumo-commit" content="${commit}">`);
  }finally{rmSync(out,{recursive:true,force:true});}
});

test('the dev server serves the same identity',async({page,request})=>{
  const response=await request.get('/version.json');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/json');
  const info=await response.json();
  expect(info).toEqual({version,commit:expect.stringMatching(/^([0-9a-f]{40}|unknown)$/),builtAt:expect.any(String),contracts});
  await page.goto('/');
  await expect(page.locator('meta[name="tazumo-version"]')).toHaveAttribute('content',version);
});
