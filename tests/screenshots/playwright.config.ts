import {defineConfig,devices} from '@playwright/test';

const port=Number(process.env.SCREENSHOT_PORT??4180);
const shared={
  locale:'en-IE',
  timezoneId:'Europe/Prague',
  colorScheme:'light' as const,
  reducedMotion:'reduce' as const,
  baseURL:`http://127.0.0.1:${port}`
};

export default defineConfig({
  testDir:'.',
  testMatch:'capture.spec.ts',
  outputDir:'../../test-results/screenshots',
  fullyParallel:false,
  workers:1,
  retries:0,
  reporter:'list',
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome'],...shared,viewport:{width:1440,height:900},deviceScaleFactor:1}},
    {name:'mobile',use:{...devices['Desktop Chrome'],...shared,viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}}
  ],
  webServer:{
    command:`pnpm --filter @tazumo/web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url:`http://127.0.0.1:${port}`,
    reuseExistingServer:false,
    timeout:60000
  }
});
