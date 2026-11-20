import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { loadConfig } from './config.ts';

export const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

export type MigrateOptions = {
  databaseUrl: string;
  direction: 'up' | 'down';
  count?: number;
  schema?: string;
  log?: (message: string) => void;
};

export async function migrate({ databaseUrl, direction, count, schema = 'public', log = () => {} }: MigrateOptions) {
  return runner({
    databaseUrl,
    dir: migrationsDir,
    direction,
    count: count ?? (direction === 'up' ? Infinity : 1),
    schema,
    createSchema: schema !== 'public',
    migrationsTable: 'schema_migrations',
    checkOrder: true,
    singleTransaction: true,
    log
  });
}

if (import.meta.main) {
  const direction = process.argv[2];
  if (direction !== 'up' && direction !== 'down') {
    console.error('Usage: migrate.ts up|down');
    process.exit(2);
  }
  const { databaseUrl } = loadConfig();
  const applied = await migrate({ databaseUrl, direction, log: (message) => console.log(message) });
  console.log(`${direction}: ${applied.length} migration(s) applied`);
}
