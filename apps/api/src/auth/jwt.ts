import { createLocalJWKSet, createRemoteJWKSet, errors, jwksCache, jwtVerify, type JSONWebKeySet, type JWTVerifyGetKey } from 'jose';

export type AuthConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  tokenType?: string;
  jwksCooldownMs?: number;
  jwksCacheMaxAgeMs?: number;
  jwksStaleMaxMs?: number;
  jwksRetryAfterFailureMs?: number;
  maxTokenLifetimeSeconds?: number;
};

export type VerifiedToken = { issuer: string; subject: string };

export class AuthError extends Error {
  readonly status: 401 | 503;
  readonly reason: string;
  readonly causeName?: string;
  constructor(status: 401 | 503, reason: string, causeName?: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
    this.causeName = causeName;
  }
}

export const allowedAlgorithms = ['RS256', 'ES256'];
export const clockToleranceSeconds = 60;

const isKeySourceFailure = (error: unknown) =>
  error instanceof errors.JWKSTimeout ||
  error instanceof errors.JWKSInvalid ||
  (error instanceof errors.JOSEError && error.constructor === errors.JOSEError) ||
  error instanceof TypeError;

export function resilientJwks(config: AuthConfig): JWTVerifyGetKey {
  const fetched: { jwks?: JSONWebKeySet; uat?: number } = {};
  const remote = createRemoteJWKSet(new URL(config.jwksUrl), {
    cooldownDuration: config.jwksCooldownMs ?? 30_000,
    cacheMaxAge: config.jwksCacheMaxAgeMs ?? 600_000,
    timeoutDuration: 5_000,
    [jwksCache]: fetched as Record<string, never>
  });
  const staleMaxMs = config.jwksStaleMaxMs ?? 24 * 3_600_000;
  const retryAfterFailureMs = config.jwksRetryAfterFailureMs ?? 30_000;
  let lastGood: { keys: JWTVerifyGetKey; at: number } | undefined;
  let failedAt: number | undefined;

  const fallback = () => (lastGood && Date.now() - lastGood.at <= staleMaxMs ? lastGood.keys : undefined);

  return async (header, token) => {
    const recentFailure = failedAt !== undefined && Date.now() - failedAt < retryAfterFailureMs;
    const stale = recentFailure ? fallback() : undefined;
    if (stale) return stale(header, token);
    try {
      const key = await remote(header, token);
      failedAt = undefined;
      if (fetched.jwks && fetched.uat !== undefined && fetched.uat !== lastGood?.at) {
        lastGood = { keys: createLocalJWKSet(fetched.jwks), at: fetched.uat };
      }
      return key;
    } catch (error) {
      if (!isKeySourceFailure(error)) throw error;
      failedAt = Date.now();
      const keys = fallback();
      if (keys) return keys(header, token);
      throw error;
    }
  };
}

export function createVerifier(config: AuthConfig) {
  const keys = resilientJwks(config);
  const maxLifetime = config.maxTokenLifetimeSeconds ?? 3_600;

  return async function verify(token: string): Promise<VerifiedToken> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: allowedAlgorithms,
        clockTolerance: clockToleranceSeconds,
        requiredClaims: ['sub', 'exp', 'iat'],
        ...(config.tokenType ? { typ: config.tokenType } : {})
      }));
    } catch (error) {
      if (isKeySourceFailure(error)) throw new AuthError(503, 'jwks_unavailable', (error as Error).name);
      if (error instanceof errors.JOSEError) throw new AuthError(401, error.code);
      throw error;
    }
    const { sub, exp, iat } = payload;
    if (typeof sub !== 'string' || sub.length < 1 || sub.length > 255) throw new AuthError(401, 'invalid_sub');
    if ((exp as number) - (iat as number) > maxLifetime) throw new AuthError(401, 'lifetime_too_long');
    if ((iat as number) > Date.now() / 1000 + clockToleranceSeconds) throw new AuthError(401, 'issued_in_future');
    return { issuer: config.issuer, subject: sub };
  };
}
