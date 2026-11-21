import {defineConfig,devices} from '@playwright/test';

const url=process.env.PAGES_URL;
if(!url)throw new Error('PAGES_URL is not set: point it at the deployed preview, e.g. https://wopee-io-demos.github.io/tazumo/');

export default defineConfig({
  testDir:'.',
  testMatch:'smoke.spec.ts',
  outputDir:'../../test-results/pages',
  retries:0,
  reporter:process.env.CI?[['github'],['list']]:'list',
  use:{...devices['Desktop Chrome'],baseURL:url,locale:'en-IE',trace:'retain-on-failure',screenshot:'on'}
});
