import type { AuthOptions } from './auth/plugin.ts';

export type Config = {
  databaseUrl: string;
  auth?: AuthOptions;
  host: string;
  port: number;
  logLevel: string;
};

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!logLevels.includes(logLevel)) throw new Error(`LOG_LEVEL must be one of ${logLevels.join(', ')}`);
  return { databaseUrl, host: env.HOST ?? '127.0.0.1', port, logLevel, auth: loadAuthConfig(env) };
}

const loopbackHosts = ['127.0.0.1', 'localhost', '[::1]'];

function loadAuthConfig(env: NodeJS.ProcessEnv): AuthOptions | undefined {
  const { AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: jwksUrl, AUTH_LOG_SALT: logSalt } = env;
  if (!issuer && !audience && !jwksUrl) return undefined;
  if (!issuer || !audience || !jwksUrl) throw new Error('AUTH_ISSUER, AUTH_AUDIENCE and AUTH_JWKS_URL must be set together');
  const url = new URL(jwksUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopbackHosts.includes(url.hostname))) {
    throw new Error('AUTH_JWKS_URL must use https (http is allowed only for loopback hosts)');
  }
  return { issuer, audience, jwksUrl, ...(logSalt ? { logSalt } : {}) };
}
