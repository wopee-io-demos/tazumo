// Test-only stack for the back-office E2E suite: a loopback OIDC provider, the real apps/api
// (one instance with auth, one without) and PostgreSQL. Never imported by the app.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { buildApp } from '../../apps/api/src/app.ts';
import { createPool } from '../../apps/api/src/db.ts';
import { migrate } from '../../apps/api/src/migrate.ts';
import { seed } from '../../apps/api/src/seed.ts';
import { audience, clientId, issuer, ports, principals, previewOrigins } from './env.mts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must point at a disposable PostgreSQL database');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'backoffice-test', alg: 'RS256', use: 'sig' };
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function mint(sub: string) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })}.${b64({ iss: issuer, aud: audience, sub, iat: now, exp: now + 300 })}`;
  return `${input}.${sign('sha256', Buffer.from(input), privateKey).toString('base64url')}`;
}

type Pending = { redirectUri: string; challenge: string; state: string };
const allowedRedirects = previewOrigins.map((origin) => `${origin}/`);
const authorizations = new Map<string, Pending>();
const codes = new Map<string, Pending & { sub: string }>();

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : String(body));
}

async function readForm(req: IncomingMessage) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return new URLSearchParams(raw);
}

const idp = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', issuer);
  const q = url.searchParams;
  if (url.pathname === '/health') return send(res, 200, { ok: true });
  if (url.pathname === '/.well-known/openid-configuration') {
    return send(res, 200, { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks.json` });
  }
  if (url.pathname === '/jwks.json') return send(res, 200, { keys: [jwk] });
  if (url.pathname === '/test-token') return send(res, 200, { access_token: mint(q.get('sub') ?? '') });
  if (url.pathname === '/authorize') {
    const redirectUri = allowedRedirects.find((allowed) => allowed === q.get('redirect_uri'));
    const valid =
      q.get('response_type') === 'code' && q.get('client_id') === clientId && q.get('code_challenge_method') === 'S256' &&
      !!q.get('code_challenge') && !!q.get('state');
    if (!valid || !redirectUri) return send(res, 400, 'invalid authorization request', 'text/plain');
    const id = randomBytes(12).toString('hex');
    authorizations.set(id, { redirectUri, challenge: q.get('code_challenge')!, state: q.get('state')! });
    const buttons = Object.keys(principals)
      .map((sub) => `<li><a href="/approve?request=${id}&sub=${sub}">Sign in as ${sub}</a></li>`)
      .join('');
    return send(res, 200, `<!doctype html><html lang="en"><title>Test sign-in</title><main><h1>Test sign-in</h1><ul>${buttons}</ul></main></html>`, 'text/html');
  }
  if (url.pathname === '/approve') {
    const pending = authorizations.get(q.get('request') ?? '');
    const sub = q.get('sub') ?? '';
    if (!pending || !(sub in principals)) return send(res, 400, 'unknown request', 'text/plain');
    authorizations.delete(q.get('request')!);
    const code = randomBytes(16).toString('hex');
    codes.set(code, { ...pending, sub });
    const location = new URL(pending.redirectUri);
    location.searchParams.set('code', code);
    location.searchParams.set('state', pending.state);
    res.writeHead(302, { location: location.toString() });
    return res.end();
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    const form = await readForm(req);
    const grant = codes.get(form.get('code') ?? '');
    codes.delete(form.get('code') ?? '');
    const verifier = form.get('code_verifier') ?? '';
    const ok =
      grant && form.get('grant_type') === 'authorization_code' && form.get('client_id') === clientId &&
      form.get('redirect_uri') === grant.redirectUri && createHash('sha256').update(verifier).digest('base64url') === grant.challenge;
    if (!ok) return send(res, 400, { error: 'invalid_grant' });
    return send(res, 200, { access_token: mint(grant.sub), token_type: 'Bearer', expires_in: 300 });
  }
  return send(res, 404, 'not found', 'text/plain');
});

await migrate({ databaseUrl, direction: 'up' });
const pool = createPool({ databaseUrl });
await seed(pool);
const { rows: merchants } = await pool.query<{ id: string }>('SELECT id FROM merchants ORDER BY name, id LIMIT 2');
for (const [sub, roles] of Object.entries(principals)) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (issuer, subject) VALUES ($1, $2) ON CONFLICT (issuer, subject) DO UPDATE SET subject = EXCLUDED.subject RETURNING id`,
    [issuer, sub],
  );
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [rows[0].id]);
  for (const role of ['customer', ...roles]) {
    const merchantId = role === 'merchant_staff' ? merchants[0].id : null;
    await pool.query('INSERT INTO user_roles (user_id, role, merchant_id) VALUES ($1, $2, $3)', [rows[0].id, role, merchantId]);
  }
}

const auth = { issuer, audience, jwksUrl: `${issuer}/jwks.json`, logSalt: 'backoffice-e2e-log-salt-not-a-secret-0001', maxTokenLifetimeSeconds: 3600 };
await buildApp({ pool, auth }).listen({ host: '127.0.0.1', port: ports.api });
await buildApp({ pool }).listen({ host: '127.0.0.1', port: ports.apiNoAuth });
await new Promise<void>((resolve) => idp.listen(ports.idp, '127.0.0.1', resolve));
console.log(`back-office test stack ready: idp ${issuer}, api :${ports.api}, api without auth :${ports.apiNoAuth}`);
