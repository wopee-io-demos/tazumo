import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import type pg from 'pg';
import { can, isPrivileged } from '../auth/policy.ts';
import { recordAudit } from '../auth/principals.ts';
import { routeSchema, toFastifyPath } from '../contract.ts';
import { apiError } from '../errors.ts';

export async function identityRoutes(app: FastifyInstance, { pool, authenticate }: { pool: pg.Pool; authenticate: onRequestHookHandler }) {
  app.get('/v1/me', { schema: routeSchema('get', '/v1/me'), onRequest: authenticate }, async (request) => {
    const principal = request.principal!;
    return { userId: principal.userId, roles: principal.grants };
  });

  const staffPath = '/v1/merchants/{merchantId}/staff';
  app.get<{ Params: { merchantId: string } }>(
    toFastifyPath(staffPath),
    { schema: routeSchema('get', staffPath), onRequest: authenticate },
    async (request, reply) => {
      const principal = request.principal!;
      const { merchantId } = request.params;
      const exists = (await pool.query('SELECT 1 FROM merchants WHERE id = $1', [merchantId])).rowCount === 1;
      const decision = can(principal, 'merchant_staff:list', { type: 'merchant', id: merchantId, exists });
      if (!decision.allowed) {
        return decision.status === 403
          ? reply.code(403).send(apiError(request, 'forbidden', 'Not allowed for this merchant'))
          : reply.code(404).send(apiError(request, 'not_found', 'Resource not found'));
      }
      if (decision.audit) {
        await recordAudit(pool, {
          actorUserId: principal.userId,
          action: 'merchant_staff:list',
          resourceType: 'merchant',
          resourceId: merchantId,
          requestId: request.id
        });
      }
      const { rows } = await pool.query(
        `SELECT ur.user_id AS "userId", ur.role
           FROM user_roles ur
          WHERE ur.merchant_id = $1
            AND ($3::boolean OR EXISTS (
                  SELECT 1 FROM user_roles caller
                   WHERE caller.user_id = $2 AND caller.role = 'merchant_staff' AND caller.merchant_id = $1))
          ORDER BY ur.created_at, ur.user_id`,
        [merchantId, principal.userId, isPrivileged(principal)]
      );
      return rows;
    }
  );
}
