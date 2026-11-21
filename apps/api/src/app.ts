import { randomBytes, randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import type pg from 'pg';
import { createAuthenticate, type AuthOptions } from './auth/plugin.ts';
import { createPseudonymizer } from './auth/pseudonym.ts';
import { componentSchemas, requiresBearer } from './contract.ts';
import { createRateLimits, type RateLimitOptions } from './rate-limit.ts';
import { apiError } from './errors.ts';
import { catalogueRoutes } from './routes/catalogue.ts';
import { healthRoutes } from './routes/health.ts';
import { identityRoutes } from './routes/identity.ts';
import { adminRoutes } from './routes/admin.ts';
import { privacyRoutes } from './routes/privacy.ts';

export type AppOptions = {
  pool: pg.Pool;
  logger?: FastifyServerOptions['logger'];
  auth?: AuthOptions;
  rateLimits?: RateLimitOptions;
  trustProxy?: FastifyServerOptions['trustProxy'];
};

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function lowerCaseUuids(values: unknown) {
  if (!values || typeof values !== 'object') return;
  const record = values as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && canonicalUuid.test(value)) record[key] = value.toLowerCase();
  }
}

export function buildApp({ pool, logger = false, auth, rateLimits, trustProxy = false }: AppOptions) {
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
    trustProxy,
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: 16 * 1024,
    ajv: { customOptions: { keywords: ['example'] } }
  });

  for (const schema of componentSchemas()) app.addSchema(schema);
  app.decorateRequest('principal', null);

  if (auth && !auth.logSalt) throw new Error('auth.logSalt is required when authentication is configured');
  const pseudonymizer = createPseudonymizer(auth?.logSalt ?? randomBytes(32).toString('hex'));
  const authenticate = createAuthenticate(pool, auth, pseudonymizer);
  const limits = createRateLimits(rateLimits);
  app.addHook('onRoute', (route) => {
    const tier = route.config?.rateLimit?.tier;
    const bearer = requiresBearer(route.method, route.url);
    if (!tier) throw new Error(`Route ${route.method} ${route.url} declares no rate-limit tier`);
    const expected = bearer ? 'authenticated' : route.url === '/health' ? 'health' : 'public';
    if (tier !== expected) {
      throw new Error(`Route ${route.method} ${route.url}: tier ${tier} does not match the contract; expected ${expected}`);
    }
    const hooks = { public: [limits.publicByIp], health: [limits.healthByIp], authenticated: [limits.byIp, authenticate, limits.byPrincipal] }[tier];
    route.onRequest = [...hooks, ...[route.onRequest ?? []].flat()];
  });

  app.addHook('preHandler', async (request) => {
    lowerCaseUuids(request.params);
    lowerCaseUuids(request.query);
  });

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

  app.setNotFoundHandler({ preHandler: limits.publicByIp }, (request, reply) => reply.code(404).send(apiError(request, 'not_found', 'Resource not found')));

  app.register(healthRoutes, { pool });
  app.register(catalogueRoutes, { pool });
  app.register(identityRoutes, { pool });
  app.register(adminRoutes, { pool });
  app.register(privacyRoutes, { pool, pseudonymizer });
  return app;
}
