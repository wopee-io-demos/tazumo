import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { can } from '../auth/policy.ts';
import { routeSchema, toFastifyPath } from '../contract.ts';
import { apiError } from '../errors.ts';

type GrantRequest = { Params: { userId: string; role: 'merchant_staff' | 'support' }; Querystring: { merchantId?: string } };
type Outcome = { status: number; code?: string; message?: string; changed?: boolean };

const rolePath = '/v1/admin/users/{userId}/roles/{role}';

async function inTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
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

export async function adminRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  function precheck(request: FastifyRequest<GrantRequest>, reply: FastifyReply) {
    const principal = request.principal!;
    const { userId, role } = request.params;
    const decision = can(principal, 'role:manage', { type: 'user', id: userId });
    if (!decision.allowed) {
      request.log.warn({ action: 'role:manage', role }, 'role change denied');
      return reply.code(403).send(apiError(request, 'forbidden', 'Not allowed to manage these roles'));
    }
    const merchantId = request.query.merchantId ?? null;
    if ((role === 'merchant_staff') !== (merchantId !== null)) {
      return reply
        .code(400)
        .send(apiError(request, 'invalid_request', 'merchantId is required for merchant_staff and not allowed for support'));
    }
    return undefined;
  }

  async function change(request: FastifyRequest<GrantRequest>, action: 'role:grant' | 'role:revoke'): Promise<Outcome> {
    const { userId, role } = request.params;
    const merchantId = request.query.merchantId ?? null;
    const actorId = request.principal!.userId;
    return inTransaction(pool, async (client) => {
      const actorIsAdmin = await client.query(`SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'`, [actorId]);
      if (actorIsAdmin.rowCount === 0) return { status: 403, code: 'forbidden', message: 'Not allowed to manage these roles' };
      const target = await client.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
      if (target.rowCount === 0) return { status: 404, code: 'user_not_found', message: 'User not found' };
      if (target.rows[0].id === actorId) return { status: 403, code: 'forbidden', message: 'Not allowed to manage these roles' };
      if (merchantId && (await client.query('SELECT 1 FROM merchants WHERE id = $1', [merchantId])).rowCount === 0) {
        return { status: 404, code: 'merchant_not_found', message: 'Merchant not found' };
      }
      const result =
        action === 'role:grant'
          ? await client.query(
              `INSERT INTO user_roles (user_id, role, merchant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
              [userId, role, merchantId]
            )
          : await client.query(
              `DELETE FROM user_roles WHERE user_id = $1 AND role = $2 AND merchant_id IS NOT DISTINCT FROM $3 RETURNING id`,
              [userId, role, merchantId]
            );
      const changed = result.rowCount === 1;
      if (changed) {
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, request_id, details)
           VALUES ($1, $2, 'user', $3, $4, $5)`,
          [actorId, action, userId, request.id, JSON.stringify({ role, merchantId })]
        );
      }
      return { status: action === 'role:revoke' ? 204 : changed ? 201 : 200, changed };
    });
  }

  app.put<GrantRequest>(toFastifyPath(rolePath), { schema: routeSchema('put', rolePath) }, async (request, reply) => {
    const rejected = precheck(request, reply);
    if (rejected) return rejected;
    const outcome = await change(request, 'role:grant');
    if (outcome.code) return reply.code(outcome.status).send(apiError(request, outcome.code, outcome.message!));
    return reply.code(outcome.status).send({ role: request.params.role, merchantId: request.query.merchantId ?? null });
  });

  app.delete<GrantRequest>(toFastifyPath(rolePath), { schema: routeSchema('delete', rolePath) }, async (request, reply) => {
    const rejected = precheck(request, reply);
    if (rejected) return rejected;
    const outcome = await change(request, 'role:revoke');
    if (outcome.code) return reply.code(outcome.status).send(apiError(request, outcome.code, outcome.message!));
    return reply.code(204).send();
  });
}
