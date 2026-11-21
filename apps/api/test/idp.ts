import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK, type JWTPayload } from 'jose';

export type SigningKey = { kid: string; alg: 'RS256' | 'ES256' | 'RS384'; privateKey: CryptoKey; jwk: JWK };

export async function signingKey(kid: string, alg: SigningKey['alg'] = 'RS256', { publishAlg = true } = {}): Promise<SigningKey> {
  const { privateKey, publicKey } = await generateKeyPair(alg, { extractable: true });
  return { kid, alg, privateKey, jwk: { ...(await exportJWK(publicKey)), kid, use: 'sig', ...(publishAlg ? { alg } : {}) } };
}

export const issuer = 'https://idp.test.invalid/';
export const audience = 'tazumo-api-test';

export type TestIdp = {
  url: string;
  keys: SigningKey[];
  fetches: number;
  status: number;
  close: () => Promise<void>;
};

export async function startIdp(keys: SigningKey[]): Promise<TestIdp> {
  const idp = { keys, fetches: 0, status: 200 } as TestIdp;
  const server: Server = createServer((_req, res) => {
    idp.fetches++;
    res.writeHead(idp.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: idp.keys.map((k) => k.jwk) }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  idp.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/jwks.json`;
  idp.close = () => new Promise((resolve) => server.close(() => resolve()));
  return idp;
}

export async function mint(key: SigningKey, claims: JWTPayload = {}, typ = 'JWT') {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iss: issuer, aud: audience, sub: 'user-1', iat: now, exp: now + 300, ...claims })
    .setProtectedHeader({ alg: key.alg, kid: key.kid, typ })
    .sign(key.privateKey);
}

export const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
export const logSalt = 'test-log-salt-'.padEnd(40, 'x');
