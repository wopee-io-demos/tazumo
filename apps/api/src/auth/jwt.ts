import { createRemoteJWKSet, errors, jwtVerify } from 'jose';

export type AuthConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksCooldownMs?: number;
  jwksCacheMaxAgeMs?: number;
};

export type VerifiedToken = { issuer: string; subject: string };

export class AuthError extends Error {
  readonly status: 401 | 503;
  readonly reason: string;
  constructor(status: 401 | 503, reason: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
  }
}

export const allowedAlgorithms = ['RS256', 'ES256'];
export const clockToleranceSeconds = 60;

const infrastructureErrors = [errors.JWKSTimeout, errors.JWKSInvalid];

export function createVerifier(config: AuthConfig) {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl), {
    cooldownDuration: config.jwksCooldownMs ?? 30_000,
    cacheMaxAge: config.jwksCacheMaxAgeMs ?? 600_000,
    timeoutDuration: 5_000
  });

  return async function verify(token: string): Promise<VerifiedToken> {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: allowedAlgorithms,
        clockTolerance: clockToleranceSeconds,
        requiredClaims: ['sub', 'exp']
      });
      return { issuer: config.issuer, subject: payload.sub as string };
    } catch (error) {
      const infrastructure =
        infrastructureErrors.some((type) => error instanceof type) ||
        (error instanceof errors.JOSEError && error.constructor === errors.JOSEError) ||
        error instanceof TypeError;
      if (infrastructure) throw new AuthError(503, 'jwks_unavailable');
      if (error instanceof errors.JOSEError) throw new AuthError(401, error.code);
      throw error;
    }
  };
}

export type Verifier = ReturnType<typeof createVerifier>;
