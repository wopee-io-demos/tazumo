import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lintRealm } from './realm-lint.mts';

const realm = () => JSON.parse(readFileSync(new URL('../../infra/idp/realm.json', import.meta.url), 'utf8'));
const web = (r: any) => r.clients.find((c: any) => c.clientId === 'tazumo-web');

test('the committed realm passes', () => assert.deepEqual(lintRealm(realm()), []));

const mutations: [string, (r: any) => void, RegExp][] = [
  ['a client secret', (r) => (web(r).secret = 'not-really-secret'), /\.secret: secrets/],
  ['a user credential', (r) => (r.users = [{ username: 'u', credentials: [{ type: 'password', value: 'x' }] }]), /credentials: secrets|realm\.users/],
  ['an SMTP password', (r) => (r.smtpServer.password = 'x'), /smtpServer\.password/],
  ['a non-localhost redirect URI', (r) => web(r).redirectUris.push('https://tazumo.example/*'), /tazumo\.example\/\* is not a localhost URI/],
  ['a wildcard redirect URI', (r) => web(r).redirectUris.push('*'), /\* is not a localhost URI/],
  ['a non-localhost web origin', (r) => web(r).webOrigins.push('https://evil.example'), /evil\.example is not a localhost URI/],
  ['a non-localhost post-logout URI', (r) => (web(r).attributes['post.logout.redirect.uris'] += '##https://evil.example/*'), /evil\.example\/\* is not a localhost URI/],
  ['a confidential client', (r) => (web(r).publicClient = false), /only public clients/],
  ['PKCE not required', (r) => delete web(r).attributes['pkce.code.challenge.method'], /PKCE S256/],
  ['the password grant', (r) => (web(r).directAccessGrantsEnabled = true), /password grant/],
  ['the device grant', (r) => (web(r).attributes['oauth2.device.authorization.grant.enabled'] = 'true'), /device\.authorization\.grant\.enabled must be off/],
  ['CIBA', (r) => (web(r).attributes['oidc.ciba.grant.enabled'] = 'true'), /ciba\.grant\.enabled must be off/],
  ['token exchange', (r) => (web(r).attributes['standard.token.exchange.enabled'] = 'true'), /token\.exchange\.enabled must be off/],
  ['a non-localhost back-channel logout URL', (r) => (web(r).attributes['backchannel.logout.url'] = 'https://evil.example/logout'), /evil\.example\/logout is not a localhost URI/],
  ['a one-hour access token', (r) => (r.accessTokenLifespan = 3600), /accessTokenLifespan/],
  ['registration off', (r) => (r.registrationAllowed = false), /registrationAllowed/],
  ['e-mail verification off', (r) => (r.verifyEmail = false), /verifyEmail/],
  ['password reset off', (r) => (r.resetPasswordAllowed = false), /resetPasswordAllowed/],
  ['no audience mapper', (r) => (web(r).protocolMappers = []), /audience mapper/],
  ['the API audience in ID tokens', (r) => (web(r).protocolMappers[0].config['id.token.claim'] = 'true'), /ID tokens/],
];

for (const [name, mutate, expected] of mutations) {
  test(`the lint fails on ${name}`, () => {
    const mutated = realm();
    mutate(mutated);
    const failures = lintRealm(mutated);
    assert.ok(failures.some((failure) => expected.test(failure)), failures.join('\n') || 'no failures');
  });
}
