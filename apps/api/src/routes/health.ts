import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

export async function healthRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.get('/health', async (request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', database: 'ok' };
    } catch (error) {
      request.log.warn({ errorName: (error as Error).name }, 'database health check failed');
      return reply.code(503).send({ status: 'unavailable', database: 'unavailable' });
    }
  });
}
