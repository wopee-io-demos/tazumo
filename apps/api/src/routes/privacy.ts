import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { can } from '../auth/policy.ts';
import type { Pseudonymizer } from '../auth/pseudonym.ts';
import { routeSchema, toFastifyPath } from '../contract.ts';
import { inTransaction } from '../db-tx.ts';
import { apiError } from '../errors.ts';

type Initiator = 'self' | 'admin' | 'support';
type ErasureOutcome =
  | { status: 200; userId: string; erasedAt: string }
  | { status: 404 | 409; code: string; message: string; details?: Record<string, unknown> };

export async function eraseUser(
  pool: pg.Pool,
  pseudonymizer: Pseudonymizer,
  { targetId, actorId, initiator, requestId }: { targetId: string; actorId: string; initiator: Initiator; requestId: string }
): Promise<ErasureOutcome> {
  return inTransaction(pool, async (client) => {
    const found = await client.query<{ issuer: string; subject: string; erasedAt: Date | null }>(
      `SELECT issuer, subject, erased_at AS "erasedAt" FROM users WHERE id = $1 FOR UPDATE`,
      [targetId]
    );
    if (found.rowCount === 0) return { status: 404, code: 'user_not_found', message: 'User not found' };
    const user = found.rows[0];
    if (user.erasedAt) return { status: 200, userId: targetId, erasedAt: user.erasedAt.toISOString() };

    const blockers: string[] = [];
    if ((await client.query(`SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'`, [targetId])).rowCount) {
      blockers.push('admin_grant');
    }
    if (blockers.length > 0) {
      return { status: 409, code: 'erasure_blocked', message: 'Dependent records must be resolved first', details: { blockers } };
    }

    const erased = await client.query<{ erasedAt: Date }>(
      `UPDATE users SET subject = $2, erased_at = now() WHERE id = $1 RETURNING erased_at AS "erasedAt"`,
      [targetId, pseudonymizer.erasedSubject(user.issuer, user.subject)]
    );
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [targetId]);
    await client.query(
      `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, request_id, details)
       VALUES ($1, 'user:erase', 'user', $2, $3, $4)`,
      [actorId, targetId, requestId, JSON.stringify({ initiator })]
    );
    return { status: 200, userId: targetId, erasedAt: erased.rows[0].erasedAt.toISOString() };
  });
}

function send(request: FastifyRequest, reply: FastifyReply, outcome: ErasureOutcome) {
  if (outcome.status === 200) return reply.send({ userId: outcome.userId, erasedAt: outcome.erasedAt });
  return reply.code(outcome.status).send(apiError(request, outcome.code, outcome.message, outcome.details));
}

export async function privacyRoutes(app: FastifyInstance, { pool, pseudonymizer }: { pool: pg.Pool; pseudonymizer: Pseudonymizer }) {
  app.post('/v1/me/erasure', { schema: routeSchema('post', '/v1/me/erasure') }, async (request, reply) => {
    const principal = request.principal!;
    const outcome = await eraseUser(pool, pseudonymizer, {
      targetId: principal.userId,
      actorId: principal.userId,
      initiator: 'self',
      requestId: request.id
    });
    return send(request, reply, outcome);
  });

  const adminPath = '/v1/admin/users/{userId}/erasure';
  app.post<{ Params: { userId: string } }>(toFastifyPath(adminPath), { schema: routeSchema('post', adminPath) }, async (request, reply) => {
    const principal = request.principal!;
    const decision = can(principal, 'user:erase', { type: 'user', id: request.params.userId });
    if (!decision.allowed) {
      request.log.warn({ action: 'user:erase' }, 'erasure denied');
      return reply.code(403).send(apiError(request, 'forbidden', 'Not allowed to erase this user'));
    }
    const initiator: Initiator =
      request.params.userId === principal.userId ? 'self' : principal.grants.some((g) => g.role === 'admin') ? 'admin' : 'support';
    const outcome = await eraseUser(pool, pseudonymizer, {
      targetId: request.params.userId,
      actorId: principal.userId,
      initiator,
      requestId: request.id
    });
    return send(request, reply, outcome);
  });

  app.get('/v1/me/export', { schema: routeSchema('get', '/v1/me/export') }, async (request) => {
    const principal = request.principal!;
    const user = await pool.query<{ issuer: string; subject: string; createdAt: Date }>(
      `SELECT issuer, subject, created_at AS "createdAt" FROM users WHERE id = $1`,
      [principal.userId]
    );
    const audit = await pool.query(
      `SELECT occurred_at AS "occurredAt", action, resource_type AS "resourceType", resource_id AS "resourceId",
              initiated_by AS "initiatedBy"
         FROM export_audit_events($1)`,
      [principal.userId]
    );
    return {
      userId: principal.userId,
      issuer: user.rows[0].issuer,
      subject: user.rows[0].subject,
      createdAt: user.rows[0].createdAt.toISOString(),
      roles: principal.grants,
      auditEvents: audit.rows.map((row) => ({ ...row, occurredAt: (row.occurredAt as Date).toISOString() }))
    };
  });
}
