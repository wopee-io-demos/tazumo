import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { apiError } from '../errors.ts';
import { AuthError, createVerifier, type AuthConfig } from './jwt.ts';
import type { Pseudonymizer } from './pseudonym.ts';
import type { Principal } from './policy.ts';
import { resolvePrincipal } from './principals.ts';

declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | null;
  }
}

export type AuthOptions = AuthConfig & { logSalt?: string };

const bearer = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*)$/i;
const challenge = 'Bearer realm="tazumo"';

export function createAuthenticate(pool: pg.Pool, options: AuthOptions | undefined, pseudonymizer: Pseudonymizer) {
  const verify = options ? createVerifier(options) : undefined;

  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    if (!verify) {
      return reply.code(503).send(apiError(request, 'auth_not_configured', 'Authentication is not configured'));
    }
    const header = request.headers.authorization;
    const match = typeof header === 'string' ? bearer.exec(header) : null;
    if (!match) {
      reply.header('www-authenticate', challenge);
      return reply.code(401).send(apiError(request, 'unauthenticated', 'Bearer token required'));
    }
    let token;
    try {
      token = await verify(match[1]);
      request.principal = await resolvePrincipal(pool, token, pseudonymizer);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      if (error.status === 503) {
        request.log.warn({ authFailure: error.reason, cause: error.causeName }, 'identity provider keys unavailable');
        return reply.code(503).send(apiError(request, 'auth_unavailable', 'Authentication is temporarily unavailable'));
      }
      request.log.info({ authFailure: error.reason }, 'token rejected');
      reply.header('www-authenticate', `${challenge}, error="invalid_token"`);
      return reply.code(401).send(apiError(request, 'invalid_token', 'Token is not valid'));
    }
    request.log.info({ principal: pseudonymizer.logTag(token.issuer, token.subject) }, 'authenticated');
  };
}
