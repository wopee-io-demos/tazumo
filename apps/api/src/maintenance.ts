import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = createPool({ databaseUrl: loadConfig().databaseUrl });
  try {
    const { rows } = await pool.query<{ forgotten: number }>('SELECT forget_erased_subjects() AS forgotten');
    console.log(`Forgot ${rows[0].forgotten} erased subject(s) past the recognition window`);
  } finally {
    await pool.end();
  }
}
