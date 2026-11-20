import type { FastifyRequest } from 'fastify';

export const apiError = (request: FastifyRequest, code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  requestId: request.id,
  ...(details ? { details } : {})
});
