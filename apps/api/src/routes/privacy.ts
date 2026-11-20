import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { can } from '../auth/policy.ts';
import type { Pseudonymizer } from '../auth/pseudonym.ts';
import { routeSchema, toFastifyPath } from '../contract.ts';
import { apiError } from '../errors.ts';

type Initiator = 'self' | 'admin' | 'support';
type ErasureOutcome =
  | { status: 200; userId: string; erasedAt: string }
  | { status: 404 | 409; code: string; message: string; details?: Record<string, unknown> };
type PrivacyOptions = { pool: pg.Pool; pseudonymizer: Pseudonymizer; recognitionWindowSeconds: number };

async function eraseUser(
  { pool, pseudonymizer, recognitionWindowSeconds }: PrivacyOptions,
  { targetId, actorId, initiator, requestId }: { targetId: string; actorId: string; initiator: Initiator; requestId: string }
): Promise<ErasureOutcome> {
  const target = await pool.query<{ issuer: string; subject: string }>('SELECT issuer, subject FROM users WHERE id = $1', [targetId]);
  if (target.rowCount === 0) return { status: 404, code: 'user_not_found', message: 'User not found' };
  const { issuer, subject } = target.rows[0];
  const pseudonym = subject.startsWith('erased:') ? 'erased:' + '0'.repeat(64) : pseudonymizer.erasedSubject(issuer, subject);
  const { rows } = await pool.query<{ outcome: string; erasedAt: Date | null; blockers: string[] | null }>(
    `SELECT result_outcome AS outcome, result_erased_at AS "erasedAt", result_blockers AS blockers
       FROM erase_user($1, $2, $3, $4, $5, make_interval(secs => $6))`,
    [targetId, pseudonym, actorId, initiator, requestId, recognitionWindowSeconds]
  );
  const result = rows[0];
  switch (result.outcome) {
    case 'not_found':
      return { status: 404, code: 'user_not_found', message: 'User not found' };
    case 'blocked':
      return { status: 409, code: 'erasure_blocked', message: 'Dependent records must be resolved first', details: { blockers: result.blockers } };
    default:
      return { status: 200, userId: targetId, erasedAt: result.erasedAt!.toISOString() };
  }
}

function send(request: FastifyRequest, reply: FastifyReply, outcome: ErasureOutcome) {
  if (outcome.status === 200) return reply.send({ userId: outcome.userId, erasedAt: outcome.erasedAt });
  return reply.code(outcome.status).send(apiError(request, outcome.code, outcome.message, outcome.details));
}

export async function privacyRoutes(app: FastifyInstance, options: PrivacyOptions) {
  const { pool } = options;

  app.post('/v1/me/erasure', { schema: routeSchema('post', '/v1/me/erasure') }, async (request, reply) => {
    const principal = request.principal!;
    const outcome = await eraseUser(options, {
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
    const outcome = await eraseUser(options, {
      targetId: request.params.userId,
      actorId: principal.userId,
      initiator,
      requestId: request.id
    });
    if (outcome.status === 409) request.log.warn({ action: 'user:erase' }, 'erasure blocked');
    return send(request, reply, outcome);
  });

  app.get('/v1/me/export', { schema: routeSchema('get', '/v1/me/export') }, async (request) => {
    const userId = request.principal!.userId;
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const user = await client.query<{ issuer: string; subject: string; createdAt: Date }>(
        `SELECT issuer, subject, created_at AS "createdAt" FROM users WHERE id = $1`,
        [userId]
      );
      const roles = await client.query(
        `SELECT role, merchant_id AS "merchantId" FROM user_roles WHERE user_id = $1 ORDER BY role, merchant_id NULLS FIRST`,
        [userId]
      );
      const audit = await client.query<{ occurredAt: Date }>(
        `SELECT occurred_at AS "occurredAt", action, resource_type AS "resourceType", resource_id AS "resourceId",
                initiated_by AS "initiatedBy", details
           FROM export_audit_events($1)`,
        [userId]
      );
      await client.query('COMMIT');
      return {
        userId,
        issuer: user.rows[0].issuer,
        subject: user.rows[0].subject,
        createdAt: user.rows[0].createdAt.toISOString(),
        roles: roles.rows,
        auditEvents: audit.rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }))
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  });
}
