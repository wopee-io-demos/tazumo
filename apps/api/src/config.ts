export type Config = {
  databaseUrl: string;
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
  return { databaseUrl, host: env.HOST ?? '127.0.0.1', port, logLevel };
}
