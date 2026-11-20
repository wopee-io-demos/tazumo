import type pg from 'pg';

export async function inTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    client.release();
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    client.release(error as Error);
    throw error;
  }
}
