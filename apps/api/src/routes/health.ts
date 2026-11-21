import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { rateLimitTier } from '../rate-limit.ts';

export async function healthRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.get('/health', { config: { rateLimit: rateLimitTier.health } }, async (request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch (error) {
      request.log.warn({ errorName: (error as Error).name }, 'database health check failed');
      return reply.code(503).send({ status: 'unavailable', database: 'unavailable' });
    }
  });
}
