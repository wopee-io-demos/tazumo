import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { BuildIdentity } from '../build-info.ts';
import { rateLimitTier } from '../rate-limit.ts';

export async function healthRoutes(app: FastifyInstance, { pool, build }: { pool: pg.Pool; build: BuildIdentity }) {
  app.get('/health', { config: { rateLimit: rateLimitTier.health } }, async (request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', database: 'ok', ...build };
    } catch (error) {
      request.log.warn({ errorName: (error as Error).name }, 'database health check failed');
      return reply.code(503).send({ status: 'unavailable', database: 'unavailable', ...build });
    }
  });
}
