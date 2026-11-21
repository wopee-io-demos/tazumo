import {defineConfig,devices} from '@playwright/test';
const port=Number(process.env.DEMO_PORT??4180);
const size={width:390,height:844};
export default defineConfig({
  testDir:'.',
  testMatch:'flow.spec.ts',
  outputDir:'../../test-results/demo',
  retries:0,
  reporter:[['list']],
  use:{
    ...devices['Desktop Chrome'],
    baseURL:`http://127.0.0.1:${port}`,
    viewport:size,
    locale:'en-IE',
    video:{mode:'on',size},
    trace:'retain-on-failure'
  },
  webServer:{
    command:`pnpm --filter @tazumo/web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url:`http://127.0.0.1:${port}`,
    reuseExistingServer:false,
    timeout:60000
  }
});
