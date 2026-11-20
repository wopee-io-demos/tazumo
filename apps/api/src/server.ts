import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';

const config = loadConfig();
const pool = createPool({ databaseUrl: config.databaseUrl });
const app = buildApp({ pool, logger: { level: config.logLevel }, auth: config.auth });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.host, port: config.port });
