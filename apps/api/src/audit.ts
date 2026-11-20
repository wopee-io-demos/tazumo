import type pg from 'pg';

export async function recordAudit(
  pool: pg.Pool,
  entry: { actorUserId: string; action: string; resourceType: string; resourceId: string; requestId: string }
) {
  await pool.query(
    `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, request_id) VALUES ($1, $2, $3, $4, $5)`,
    [entry.actorUserId, entry.action, entry.resourceType, entry.resourceId, entry.requestId]
  );
}
