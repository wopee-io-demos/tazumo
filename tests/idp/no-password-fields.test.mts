// Tazumo apps and the API never collect passwords: sign-up, sign-in and reset happen on the identity provider's pages (#87).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url).pathname;
const passwordName = /pass(word|wd|phrase|code)|^pwd$|credential/i;
const passwordInput = [
  /type\s*[=:]\s*\{?\s*["'`]password["'`]/i,
  /secureTextEntry/,
  /auto[cC]omplete\s*[=:]\s*\{?\s*["'`](current|new|one-time)-password/i,
  /textContentType\s*[=:]\s*\{?\s*["'`](password|newPassword)/,
];

function propertyNames(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item) => propertyNames(item, out));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'properties' || key === 'patternProperties') && value && typeof value === 'object') out.push(...Object.keys(value));
      if (key === 'parameters' && Array.isArray(value)) out.push(...value.map((p: { name?: string }) => p.name ?? ''));
      propertyNames(value, out);
    }
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.expo', 'ios', 'android', 'migrations'].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(tsx?|jsx?|html)$/.test(name)) out.push(path);
  }
  return out;
}

const findInputs = (source: string) => passwordInput.filter((pattern) => pattern.test(source)).map(String);

test('no API operation accepts a password-like field', () => {
  const contract = JSON.parse(readFileSync(join(root, 'contracts/openapi.json'), 'utf8'));
  const names = propertyNames(contract).filter((name) => passwordName.test(name));
  assert.deepEqual(names, []);
});

test('no app renders a password input', () => {
  const files = readdirSync(join(root, 'apps')).flatMap((app) => sourceFiles(join(root, 'apps', app)));
  assert.ok(files.length > 20, `expected app sources, found ${files.length}`);
  const offenders = files.map((file) => [file.slice(root.length), findInputs(readFileSync(file, 'utf8'))] as const).filter(([, hits]) => hits.length);
  assert.deepEqual(offenders, []);
});

test('the detectors catch password fields', () => {
  for (const sample of ['<input type="password" />', '<TextInput secureTextEntry />', "autoComplete='current-password'", 'textContentType="newPassword"', "{ type: 'password' }"]) {
    assert.notDeepEqual(findInputs(sample), [], sample);
  }
  assert.deepEqual(propertyNames({ properties: { newPassword: {} } }).filter((n) => passwordName.test(n)), ['newPassword']);
});
