import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'apps/backoffice/dist';
const forbidden = [/PRIVATE KEY/, /generateKeyPair/, /createSign|\bsign\(\s*['"]sha256/, /test-token/, /bo-(admin|support|staff|customer|target)/, /localStorage/, /\beyJ[A-Za-z0-9_-]{10,}/];
const files = readdirSync(dist, { recursive: true }).map(String).filter((f) => /\.(js|html|css|map)$/.test(f));
if (files.length === 0) throw new Error(`no build output in ${dist}`);
let failed = false;
for (const file of files) {
  const text = readFileSync(join(dist, file), 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`${file}: forbidden pattern ${pattern}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log(`bundle check passed: ${files.length} files, no test-token code or token storage`);
