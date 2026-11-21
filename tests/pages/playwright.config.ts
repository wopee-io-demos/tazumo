import {defineConfig,devices} from '@playwright/test';

const raw=process.env.PAGES_URL;
if(!raw)throw new Error('PAGES_URL is not set: point it at the deployed preview, e.g. https://wopee-io-demos.github.io/tazumo/');
const url=raw.endsWith('/')?raw:`${raw}/`;

export default defineConfig({
  testDir:'.',
  testMatch:'smoke.spec.ts',
  outputDir:'../../test-results/pages',
  retries:0,
  reporter:process.env.CI?[['github'],['list']]:'list',
  use:{...devices['Desktop Chrome'],baseURL:url,locale:'en-IE',trace:'retain-on-failure',screenshot:'on'}
});
