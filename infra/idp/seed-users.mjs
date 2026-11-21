// Creates or resets the development test users with freshly generated passwords.
// Passwords are written only to infra/idp/.local/test-users.json (gitignored, mode 0600).
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '.env'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const base = `http://127.0.0.1:${process.env.IDP_PORT ?? env.IDP_PORT ?? 48180}`;
const realm = 'tazumo';
const users = ['customer', 'merchant-staff', 'support', 'admin'].map((name) => ({ name, email: `dev-${name}@tazumo.test` }));

async function call(path, init = {}) {
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 || response.status === 201 ? null : response.json();
}

const { access_token } = await call('/realms/master/protocol/openid-connect/token', {
  method: 'POST',
  body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'dev-only-admin', password: env.IDP_ADMIN_PASSWORD }),
});
const headers = { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' };
const admin = (path, init = {}) => call(`/admin/realms/${realm}${path}`, { ...init, headers });

const created = [];
for (const user of users) {
  const password = randomBytes(18).toString('base64url');
  let [existing] = await admin(`/users?email=${encodeURIComponent(user.email)}&exact=true`);
  if (!existing) {
    await admin('/users', {
      method: 'POST',
      body: JSON.stringify({ username: user.email, email: user.email, emailVerified: true, enabled: true, firstName: 'Test', lastName: user.name }),
    });
    [existing] = await admin(`/users?email=${encodeURIComponent(user.email)}&exact=true`);
  }
  await admin(`/users/${existing.id}/reset-password`, { method: 'PUT', body: JSON.stringify({ type: 'password', value: password, temporary: false }) });
  created.push({ ...user, subject: existing.id, password });
}

mkdirSync(join(here, '.local'), { recursive: true, mode: 0o700 });
writeFileSync(join(here, '.local/test-users.json'), `${JSON.stringify(created, null, 2)}\n`, { mode: 0o600 });
console.log(`Seeded ${created.length} test users in realm ${realm}; passwords in infra/idp/.local/test-users.json`);
