import pg from 'pg';

export type PoolOptions = { databaseUrl: string; schema?: string };

export function createPool({ databaseUrl, schema }: PoolOptions): pg.Pool {
  if (schema !== undefined && !/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid schema name');
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    application_name: 'tazumo-api',
    max: 10,
    statement_timeout: 5000,
    connectionTimeoutMillis: 5000,
    ...(schema ? { options: `-c search_path=${schema}` } : {})
  });
  pool.on('error', (error: Error & { code?: string }) => {
    process.emitWarning(`idle PostgreSQL client error ${error.code ?? error.name}`);
  });
  return pool;
}
