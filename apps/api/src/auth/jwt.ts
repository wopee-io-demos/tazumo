import { createLocalJWKSet, createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

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
const snapshotRefreshMs = 60_000;

const isKeySourceFailure = (error: unknown) =>
  error instanceof errors.JWKSTimeout ||
  error instanceof errors.JWKSInvalid ||
  (error instanceof errors.JOSEError && error.constructor === errors.JOSEError) ||
  error instanceof TypeError;

export function resilientJwks(config: AuthConfig): JWTVerifyGetKey {
  const remote = createRemoteJWKSet(new URL(config.jwksUrl), {
    cooldownDuration: config.jwksCooldownMs ?? 30_000,
    cacheMaxAge: config.jwksCacheMaxAgeMs ?? 600_000,
    timeoutDuration: 5_000
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
      if (!lastGood || Date.now() - lastGood.at > snapshotRefreshMs) {
        const snapshot = remote.jwks();
        if (snapshot) lastGood = { keys: createLocalJWKSet(snapshot), at: Date.now() };
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
        requiredClaims: ['sub', 'exp'],
        ...(config.tokenType ? { typ: config.tokenType } : {})
      }));
    } catch (error) {
      if (isKeySourceFailure(error)) throw new AuthError(503, 'jwks_unavailable', (error as Error).name);
      if (error instanceof errors.JOSEError) throw new AuthError(401, error.code);
      throw error;
    }
    const { sub, exp } = payload;
    if (typeof sub !== 'string' || sub.length < 1 || sub.length > 255) throw new AuthError(401, 'invalid_sub');
    if ((exp as number) - Date.now() / 1000 > maxLifetime + clockToleranceSeconds) {
      throw new AuthError(401, 'lifetime_too_long');
    }
    return { issuer: config.issuer, subject: sub };
  };
}
