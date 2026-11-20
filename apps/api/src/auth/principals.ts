import type pg from 'pg';
import type { Grant, Principal } from './policy.ts';
import type { VerifiedToken } from './jwt.ts';

export async function resolvePrincipal(pool: pg.Pool, token: VerifiedToken): Promise<Principal> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
    const grants = await client.query<Grant>(
      `SELECT role, merchant_id AS "merchantId" FROM user_roles WHERE user_id = $1 ORDER BY role, merchant_id NULLS FIRST`,
      [userId]
    );
    await client.query('COMMIT');
    return { userId, grants: grants.rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordAudit(
  pool: pg.Pool,
  entry: { actorUserId: string; action: string; resourceType: string; resourceId: string; requestId: string }
) {
  await pool.query(
    `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, request_id) VALUES ($1, $2, $3, $4, $5)`,
    [entry.actorUserId, entry.action, entry.resourceType, entry.resourceId, entry.requestId]
  );
}
