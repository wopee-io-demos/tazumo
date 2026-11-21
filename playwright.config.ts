import { defineConfig, devices } from '@playwright/test';
const port=Number(process.env.PLAYWRIGHT_PORT??4173);
const baseURL=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./tests/e2e',
  outputDir:'./test-results',
  fullyParallel:true,
  retries:process.env.CI?1:0,
  reporter:[
    process.env.CI?['github']:['list'],
    ['html',{open:'never',outputFolder:'playwright-report'}]
  ],
  use:{baseURL,trace:'retain-on-failure',screenshot:'on'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{
    command:`pnpm --filter @tazumo/web dev --host 127.0.0.1 --port ${port} --strictPort`,
    url:baseURL,
    reuseExistingServer:!process.env.CI,
    timeout:90000
  }
});
