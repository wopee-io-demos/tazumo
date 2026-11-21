import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { apiBase, audience, issuer, oidc, tokenType } from '../idp/env.mts';
import { webApp, webClientId } from './env.mts';

const node = 'node --experimental-strip-types apps/api/src';
const web = 'pnpm --filter @tazumo/web';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: '../../test-results/web-auth',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [process.env.CI ? ['github'] : ['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/web-auth' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [{
    command: `${node}/migrate.ts up && ${node}/server.ts`,
    cwd: '../..',
    url: `${apiBase}/health`,
    timeout: 120_000,
    env: {
      PORT: new URL(apiBase).port,
      AUTH_ISSUER: issuer,
      AUTH_AUDIENCE: audience,
      AUTH_JWKS_URL: oidc.jwks,
      AUTH_TOKEN_TYPE: tokenType,
      AUTH_MAX_TOKEN_LIFETIME: '900',
      AUTH_LOG_SALT: randomBytes(24).toString('hex'),
    },
  }, {
    command: `${web} build && ${web} exec vite preview --host 127.0.0.1 --port ${new URL(webApp).port} --strictPort`,
    cwd: '../..',
    url: webApp,
    timeout: 240_000,
    env: { VITE_OIDC_ISSUER: issuer, VITE_OIDC_CLIENT_ID: webClientId, VITE_OIDC_SCOPE: 'openid', TAZUMO_API_URL: apiBase },
  }],
});
