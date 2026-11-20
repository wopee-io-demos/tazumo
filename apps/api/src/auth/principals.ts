import type pg from 'pg';
import type { Grant, Principal } from './policy.ts';
import { AuthError, clockToleranceSeconds, type VerifiedToken } from './jwt.ts';
import type { Pseudonymizer } from './pseudonym.ts';

export async function resolvePrincipal(pool: pg.Pool, token: VerifiedToken, pseudonymizer: Pseudonymizer): Promise<Principal> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rejectIfErased = async () => {
      const erased = await client.query<{ erasedAt: string }>(
        `SELECT ceil(extract(epoch FROM erased_at))::bigint AS "erasedAt" FROM users WHERE issuer = $1 AND subject = $2`,
        [token.issuer, pseudonymizer.erasedSubject(token.issuer, token.subject)]
      );
      if (erased.rowCount && token.issuedAt <= Number(erased.rows[0].erasedAt) + clockToleranceSeconds) {
        throw new AuthError(401, 'subject_erased');
      }
    };
    await rejectIfErased();
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (issuer, subject) VALUES ($1, $2) ON CONFLICT (issuer, subject) DO NOTHING RETURNING id`,
      [token.issuer, token.subject]
    );
    let userId = inserted.rows[0]?.id;
    if (userId) {
      await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'customer')`, [userId]);
    } else {
      const existing = await client.query<{ id: string }>(`SELECT id FROM users WHERE issuer = $1 AND subject = $2`, [
        token.issuer,
        token.subject
      ]);
      userId = existing.rows[0].id;
    }
    await rejectIfErased();
    const grants = await client.query<Grant>(
      `SELECT role, merchant_id AS "merchantId" FROM user_roles WHERE user_id = $1 ORDER BY role, merchant_id NULLS FIRST`,
      [userId]
    );
    await client.query('COMMIT');
    client.release();
    return { userId, grants: grants.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    client.release(error instanceof AuthError ? undefined : (error as Error));
    throw error;
  }
}
