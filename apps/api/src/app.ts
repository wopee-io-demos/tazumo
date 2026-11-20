import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import type pg from 'pg';
import { createAuthenticate, type AuthOptions } from './auth/plugin.ts';
import { componentSchemas } from './contract.ts';
import { apiError } from './errors.ts';
import { catalogueRoutes } from './routes/catalogue.ts';
import { healthRoutes } from './routes/health.ts';
import { identityRoutes } from './routes/identity.ts';

export type AppOptions = { pool: pg.Pool; logger?: FastifyServerOptions['logger']; auth?: AuthOptions };

export function buildApp({ pool, logger = false, auth }: AppOptions) {
  const loggerOptions = logger === true ? {} : logger;
  const app = Fastify({
    logger:
      loggerOptions && typeof loggerOptions === 'object'
        ? {
            ...loggerOptions,
            redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
            serializers: {
              req: (request: FastifyRequest) => ({ method: request.method, route: request.routeOptions?.url ?? 'unmatched' }),
              res: (reply: { statusCode: number }) => ({ statusCode: reply.statusCode })
            }
          }
        : false,
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: 16 * 1024,
    ajv: { customOptions: { keywords: ['example'] } }
  });

  for (const schema of componentSchemas()) app.addSchema(schema);
  app.decorateRequest('principal', null);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send(
        apiError(request, 'invalid_request', 'Request validation failed', {
          location: error.validationContext,
          issues: error.validation.map((issue) => ({ path: issue.instancePath, keyword: issue.keyword, message: issue.message }))
        })
      );
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send(apiError(request, 'bad_request', 'Malformed request'));
    }
    request.log.error({ errorName: error.name, errorCode: error.code }, 'request failed');
    return reply.code(500).send(apiError(request, 'internal_error', 'Internal server error'));
  });

  app.setNotFoundHandler((request, reply) => reply.code(404).send(apiError(request, 'not_found', 'Resource not found')));

  app.register(healthRoutes, { pool });
  app.register(catalogueRoutes, { pool });
  app.register(identityRoutes, { pool, authenticate: createAuthenticate(pool, auth) });
  return app;
}
