import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('every route type has a localised page title',async({page})=>{
  await page.goto('/');
  await expect(page).toHaveTitle('Explore your neighbourhood · Tazumo (demo)');
  await page.goto('/#/merchant/piazza-local');
  await expect(page).toHaveTitle('Piazza Local · Tazumo (demo)');
  await page.goto('/#/product/bread');
  await expect(page).toHaveTitle('Sourdough loaf · Tazumo (demo)');
  await page.goto('/#/merchant/nope');
  await expect(page).toHaveTitle('Not found · Tazumo (demo)');
  await page.goto('/#/product/nope');
  await expect(page).toHaveTitle('Not found · Tazumo (demo)');
});

test('title follows language changes',async({page})=>{
  await page.goto('/#/merchant/nope');
  await page.getByTestId('sut-language').selectOption('cs');
  await expect(page).toHaveTitle('Nenalezeno · Tazumo (ukázka)');
  await page.getByTestId('sut-language').selectOption('de');
  await expect(page).toHaveTitle('Nicht gefunden · Tazumo (Demo)');
  await page.getByTestId('sut-back-to-merchants').click();
  await expect(page).toHaveTitle('Entdecke deine Umgebung · Tazumo (Demo)');
});

test('title is never empty or stale after back and forward navigation',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-merchant-link-green-table').click();
  await expect(page).toHaveTitle('Green Table · Tazumo (demo)');
  await page.getByTestId('sut-product-link-bowl').click();
  await expect(page).toHaveTitle('Seasonal veggie bowl · Tazumo (demo)');
  await page.goBack();
  await expect(page).toHaveTitle('Green Table · Tazumo (demo)');
  await page.goBack();
  await expect(page).toHaveTitle('Explore your neighbourhood · Tazumo (demo)');
  await page.goForward();
  await expect(page).toHaveTitle('Green Table · Tazumo (demo)');
});

test('robots.txt disallows all crawling',async({request})=>{
  const response=await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toMatch(/User-agent: \*\s+Disallow: \/\s*$/);
});

test('production build is noindex and carries no business or rating markup',()=>{
  const out=mkdtempSync(join(tmpdir(),'tazumo-meta-'));
  execFileSync('pnpm',['--filter','@tazumo/web','exec','vite','build','--outDir',out,'--emptyOutDir','--logLevel','error'],{stdio:'inherit'});
  const html=readFileSync(join(out,'index.html'),'utf8');
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
  expect(readFileSync(join(out,'robots.txt'),'utf8')).toContain('Disallow: /');
  const files=(dir:string):string[]=>readdirSync(dir).flatMap(f=>statSync(join(dir,f)).isDirectory()?files(join(dir,f)):[join(dir,f)]);
  const text=files(out).filter(f=>/\.(html|js|css|txt|json|xml)$/.test(f)).map(f=>readFileSync(f,'utf8')).join('\n');
  expect(text).not.toMatch(/application\/ld\+json|aggregateRating|schema\.org|og:(title|type|site_name)|sitemap/i);
  expect(files(out).some(f=>/sitemap/i.test(f))).toBe(false);
});
