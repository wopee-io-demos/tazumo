import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { acceptanceStates, declineReasons, orderStatuses, roles } from './index.ts';

const repo = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, repo), 'utf8');
const literals = (source: string, pattern: RegExp) => {
  const match = source.match(pattern);
  assert.ok(match, `pattern ${pattern} not found`);
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe('drift against the contract and sibling modules', () => {
  const contract = JSON.parse(read('contracts/openapi.json'));

  it('uses exactly the contract order statuses', () => {
    assert.deepEqual([...orderStatuses], contract.components.schemas.Order.properties.status.enum);
  });

  it('uses the contract Money shape', () => {
    const money = contract.components.schemas.Money;
    assert.deepEqual([...money.required].sort(), ['currency', 'minorUnits']);
    assert.equal(money.properties.minorUnits.type, 'integer');
    assert.equal(money.properties.minorUnits.minimum, 0);
  });

  it('uses the roles of the API policy and migration 0002 (ADR-0016)', () => {
    assert.deepEqual(literals(read('apps/api/src/auth/policy.ts'), /export const roles = \[([^\]]+)\]/), [...roles]);
    assert.deepEqual(literals(read('apps/api/migrations/0002_identity-and-roles.sql'), /role IN \(([^)]+)\)/), [...roles]);
  });

  const merchantOps = 'packages/merchant-ops/src/acceptance.ts';
  it('matches the merchant-ops acceptance states and decline reasons', { skip: !existsSync(new URL(merchantOps, repo)) && 'packages/merchant-ops not on this branch yet (PR #76)' }, () => {
    const source = read(merchantOps);
    assert.deepEqual(literals(source, /declineReasons = \[([^\]]+)\]/), [...declineReasons]);
    assert.deepEqual(literals(source, /state: ([^;]+);/), [...acceptanceStates]);
    for (const field of ['orderId: string', 'merchantId: string', 'receivedAt: string', 'deadline: string', 'decidedAt?: string']) assert.ok(source.includes(field), field);
  });

  const commerce = 'packages/commerce/src/money.ts';
  it('matches the @tazumo/commerce Money type', { skip: !existsSync(new URL(commerce, repo)) && 'packages/commerce not on this branch yet (#11)' }, () => {
    assert.match(read(commerce), /export type Money = \{ currency: string; minorUnits: number \}/);
  });
});
