import { createHmac } from 'node:crypto';

export type Pseudonymizer = {
  logTag: (issuer: string, subject: string) => string;
  erasedSubject: (issuer: string, subject: string) => string;
};

export const erasedPrefix = 'erased:';

export function createPseudonymizer(salt: string): Pseudonymizer {
  const mac = (...parts: string[]) => createHmac('sha256', salt).update(parts.join('\n')).digest('hex');
  return {
    logTag: (issuer, subject) => mac(issuer, subject).slice(0, 16),
    erasedSubject: (issuer, subject) => `${erasedPrefix}${mac('erasure', issuer, subject)}`
  };
}
