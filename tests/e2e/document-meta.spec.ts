import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync,statSync} from 'node:fs';
import {brandName} from '../../packages/brand/src/index.ts';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const title=(page:string,demo='demo')=>`${page} · ${brandName} (${demo})`;

test('every route type has a localised page title',async({page})=>{
  await page.goto('/');
  await expect(page).toHaveTitle(title('Explore your neighbourhood'));
  await page.goto('/#/merchant/piazza-local');
  await expect(page).toHaveTitle(title('Piazza Local'));
  await page.goto('/#/product/bread');
  await expect(page).toHaveTitle(title('Sourdough loaf'));
  await page.goto('/#/merchant/nope');
  await expect(page).toHaveTitle(title('Not found'));
  await page.goto('/#/product/nope');
  await expect(page).toHaveTitle(title('Not found'));
});

test('title follows language changes',async({page})=>{
  await page.goto('/#/merchant/nope');
  await page.getByTestId('sut-language').selectOption('cs');
  await expect(page).toHaveTitle(title('Nenalezeno', 'ukázka'));
  await page.getByTestId('sut-language').selectOption('de');
  await expect(page).toHaveTitle(title('Nicht gefunden', 'Demo'));
  await page.getByTestId('sut-back-to-merchants').click();
  await expect(page).toHaveTitle(title('Entdecke deine Umgebung', 'Demo'));
});

test('localised titles on detail pages survive a reload',async({page})=>{
  await page.goto('/#/product/apples');
  await page.getByTestId('sut-language').selectOption('cs');
  await expect(page).toHaveTitle(title('Local apples 1 kg', 'ukázka'));
  await page.reload();
  await expect(page).toHaveTitle(title('Local apples 1 kg', 'ukázka'));
  await page.goto('/#/merchant/does-not-exist');
  await expect(page).toHaveTitle(title('Nenalezeno', 'ukázka'));
});

test('title is never empty or stale after back and forward navigation',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-merchant-link-green-table').click();
  await expect(page).toHaveTitle(title('Green Table'));
  await page.getByTestId('sut-product-link-bowl').click();
  await expect(page).toHaveTitle(title('Seasonal veggie bowl'));
  await page.goBack();
  await expect(page).toHaveTitle(title('Green Table'));
  await page.goBack();
  await expect(page).toHaveTitle(title('Explore your neighbourhood'));
  await page.goForward();
  await expect(page).toHaveTitle(title('Green Table'));
});

test('robots.txt disallows all crawling',async({request})=>{
  const response=await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toMatch(/User-agent: \*\s+Disallow: \/\s*$/);
});

test('production build is noindex and carries no business or rating markup',()=>{
  test.setTimeout(120_000);
  const out=mkdtempSync(join(tmpdir(),'tazumo-meta-'));
  try{
    execFileSync('pnpm',['--filter','@tazumo/web','exec','vite','build','--outDir',out,'--emptyOutDir','--logLevel','error'],{stdio:'inherit',timeout:110_000});
    const html=readFileSync(join(out,'index.html'),'utf8');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(readFileSync(join(out,'robots.txt'),'utf8')).toMatch(/User-agent: \*\s+Disallow: \/\s*$/);
    const files=(dir:string):string[]=>readdirSync(dir).flatMap(f=>statSync(join(dir,f)).isDirectory()?files(join(dir,f)):[join(dir,f)]);
    const text=files(out).filter(f=>/\.(html|js|css|txt|json|xml)$/.test(f)).map(f=>readFileSync(f,'utf8')).join('\n');
    expect(text).not.toMatch(/application\/ld\+json|schema\.org|aggregateRating|ratingValue|reviewCount|sitemap/i);
    expect(html).not.toMatch(/property="og:|itemscope|itemprop/i);
    expect(files(out).some(f=>/sitemap/i.test(f))).toBe(false);
  }finally{rmSync(out,{recursive:true,force:true});}
});
