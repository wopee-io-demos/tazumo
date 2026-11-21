import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { apiBase, audience, clients, issuer, oidc, tokenType } from './env.mts';

const node = 'node --experimental-strip-types apps/api/src';
const backoffice = 'pnpm --filter @tazumo/backoffice';
const backofficePort = new URL(clients.backoffice.redirectUri).port;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: '../../test-results/idp',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [process.env.CI ? ['github'] : ['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/idp' }]],
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
    command: 'node --experimental-strip-types tests/idp/callback-server.mts',
    cwd: '../..',
    url: clients.web.redirectUri,
    timeout: 30_000,
  }, {
    command: `${backoffice} build && ${backoffice} preview --port ${backofficePort} --strictPort`,
    cwd: '../..',
    url: clients.backoffice.redirectUri,
    timeout: 240_000,
    env: { VITE_OIDC_ISSUER: issuer, VITE_OIDC_CLIENT_ID: clients.backoffice.id, VITE_OIDC_SCOPE: 'openid', BACKOFFICE_API_URL: apiBase },
  }],
});
