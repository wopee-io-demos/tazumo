import pg from 'pg';

export type PoolOptions = { databaseUrl: string; schema?: string };

export function createPool({ databaseUrl, schema }: PoolOptions): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    application_name: 'tazumo-api',
    max: 10,
    statement_timeout: 5000,
    connectionTimeoutMillis: 5000,
    ...(schema ? { options: `-c search_path=${schema}` } : {})
  });
}
