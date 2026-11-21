import { defineConfig, devices } from '@playwright/test';
import { clientId, issuer, ports } from './env.mts';

const app = 'pnpm --filter @tazumo/backoffice';
const buildEnv = `VITE_OIDC_ISSUER=${issuer} VITE_OIDC_CLIENT_ID=${clientId}`;

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/backoffice',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [process.env.CI ? ['github'] : ['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/backoffice' }]],
  use: { baseURL: `http://127.0.0.1:${ports.preview}`, trace: 'retain-on-failure', screenshot: 'on' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Playwright starts these in order, so the third preview serves the build made by the second.
  webServer: [
    { command: 'node --experimental-strip-types tests/backoffice/stack.mts', url: `${issuer}/health`, cwd: '../..', timeout: 240_000 },
    {
      command: `${buildEnv} ${app} build && BACKOFFICE_API_URL=http://127.0.0.1:${ports.api} ${app} preview --port ${ports.preview} --strictPort`,
      url: `http://127.0.0.1:${ports.preview}`,
      cwd: '../..',
      timeout: 240_000,
    },
    {
      command: `BACKOFFICE_API_URL=http://127.0.0.1:${ports.apiNoAuth} ${app} preview --port ${ports.previewNoAuth} --strictPort`,
      url: `http://127.0.0.1:${ports.previewNoAuth}`,
      cwd: '../..',
      timeout: 120_000,
    },
  ],
});
