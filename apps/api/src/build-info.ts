import { readFileSync } from 'node:fs';

export type BuildIdentity = { version: string; commit: string };

const fullSha = /^[0-9a-f]{40}$/;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

/** The product version from package.json and the source commit from TAZUMO_COMMIT ("unknown" unless a full SHA). */
export function buildIdentity(env: NodeJS.ProcessEnv = process.env): BuildIdentity {
  const commit = env.TAZUMO_COMMIT ?? '';
  return { version, commit: fullSha.test(commit) ? commit : 'unknown' };
}
