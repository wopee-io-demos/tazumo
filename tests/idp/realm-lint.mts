// Fails if the committed Keycloak realm could leak a secret or a credential, or redirect outside localhost.
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Client = Record<string, any>;

export const apiAudience = 'tazumo-api';
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const sensitiveKey = /secret|password|credential|private.?key|certificate|token$/i;
const allowedKeys = new Set(['resetPasswordAllowed', 'passwordPolicy']);
const audienceProbe = 'tazumo-audience-probe';

function sensitivePaths(value: Json, path: string, out: string[]) {
  if (Array.isArray(value)) value.forEach((item, i) => sensitivePaths(item, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (sensitiveKey.test(key) && !allowedKeys.has(key)) out.push(`${path}.${key}`);
      sensitivePaths(child, `${path}.${key}`, out);
    }
  }
  return out;
}

function isLoopback(uri: string) {
  try {
    return loopbackHosts.has(new URL(uri).hostname);
  } catch {
    return false;
  }
}

export function lintRealm(realm: Record<string, any>): string[] {
  const failures = sensitivePaths(realm, 'realm', []).map((path) => `${path}: secrets and credentials must not be committed`);
  if (realm.users?.length) failures.push('realm.users: test users are created by infra/idp/seed-users.mjs, never committed');
  if (realm.identityProviders?.length) failures.push('realm.identityProviders: brokered providers are out of scope (#87)');
  if (!(realm.accessTokenLifespan >= 300 && realm.accessTokenLifespan <= 900)) failures.push('realm.accessTokenLifespan must be 300 to 900 seconds');
  for (const flag of ['registrationAllowed', 'verifyEmail', 'resetPasswordAllowed']) {
    if (realm[flag] !== true) failures.push(`realm.${flag} must be true`);
  }

  const clients: Client[] = realm.clients ?? [];
  if (clients.length === 0) failures.push('realm.clients: no clients defined');
  for (const client of clients) {
    const name = `client ${client.clientId}`;
    if (client.clientId === apiAudience) failures.push(`${name}: the API audience must not be a client ID (ADR-0016)`);
    if (client.publicClient !== true || client.bearerOnly) failures.push(`${name}: only public clients are allowed`);
    if (client.attributes?.['pkce.code.challenge.method'] !== 'S256') failures.push(`${name}: PKCE S256 must be required`);
    if (client.directAccessGrantsEnabled !== false) failures.push(`${name}: the password grant must be disabled`);
    if (client.implicitFlowEnabled || client.serviceAccountsEnabled) failures.push(`${name}: implicit flow and service accounts must be off`);
    const uris = [
      ...(client.redirectUris ?? []),
      ...(client.webOrigins ?? []).filter((origin: string) => origin !== '+'),
      ...String(client.attributes?.['post.logout.redirect.uris'] ?? '').split('##').filter(Boolean),
      ...['rootUrl', 'baseUrl', 'adminUrl'].map((key) => client[key]).filter(Boolean),
    ];
    for (const uri of uris) if (!isLoopback(uri)) failures.push(`${name}: ${uri} is not a localhost URI`);
    const audienceMapper = (client.protocolMappers ?? []).find(
      (mapper: Client) => mapper.protocolMapper === 'oidc-audience-mapper' && mapper.config?.['included.custom.audience'] === apiAudience,
    );
    if (client.clientId !== audienceProbe && audienceMapper?.config?.['access.token.claim'] !== 'true') {
      failures.push(`${name}: missing the ${apiAudience} audience mapper on access tokens`);
    }
    if (audienceMapper?.config?.['id.token.claim'] === 'true') failures.push(`${name}: the API audience must not be added to ID tokens`);
  }
  return failures;
}

const entry = process.argv[1] && realpathSync(process.argv[1]);
if (entry === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? fileURLToPath(new URL('../../infra/idp/realm.json', import.meta.url));
  const failures = lintRealm(JSON.parse(readFileSync(file, 'utf8')));
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log(`${file}: public PKCE clients only, localhost redirects, no secrets or credentials`);
}
