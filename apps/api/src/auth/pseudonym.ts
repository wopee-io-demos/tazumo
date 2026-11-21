import { createHmac, hkdfSync } from 'node:crypto';

export type Pseudonymizer = {
  logTag: (issuer: string, subject: string) => string;
  erasedSubject: (issuer: string, subject: string) => string;
};

export const erasedPrefix = 'erased:';

const encode = (parts: string[]) =>
  Buffer.concat(parts.flatMap((part) => {
    const bytes = Buffer.from(part, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    return [length, bytes];
  }));

export function createPseudonymizer(salt: string): Pseudonymizer {
  const key = (label: string) => Buffer.from(hkdfSync('sha256', salt, Buffer.alloc(0), `tazumo:${label}:v1`, 32));
  const logKey = key('log-tag');
  const erasureKey = key('erasure');
  const mac = (k: Buffer, parts: string[]) => createHmac('sha256', k).update(encode(parts)).digest('hex');
  return {
    logTag: (issuer, subject) => mac(logKey, [issuer, subject]).slice(0, 16),
    erasedSubject: (issuer, subject) => `${erasedPrefix}${mac(erasureKey, [issuer, subject])}`
  };
}
