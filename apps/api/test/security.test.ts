import { Writable } from 'node:stream';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { createTestDb } from './helpers.ts';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(chunk.toString());
      done();
    }
  });
  return { lines, logger: { level: 'info', stream } };
}

test('request logs omit query strings, client IPs and credentials', async () => {
  const db = await createTestDb();
  const { lines, logger } = capture();
  const app = buildApp({ pool: db.pool, logger });
  try {
    await seed(db.pool);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/merchants?marketCode=demo&email=jane.doe%40example.com',
      headers: { authorization: 'Bearer secret-token-123', cookie: 'session=abc123' },
      remoteAddress: '203.0.113.7'
    });
    assert.equal(res.statusCode, 200);
    const log = lines.join('');
    assert.match(log, /"route":"\/v1\/merchants"/);
    for (const leaked of ['jane.doe', 'example.com', 'secret-token-123', 'abc123', '203.0.113.7', 'marketCode=']) {
      assert.ok(!log.includes(leaked), `log leaked ${leaked}`);
    }
  } finally {
    await app.close();
    await db.drop();
  }
});

test('database failures return a generic 500 without internals', async () => {
  const db = await createTestDb({ migrated: false });
  const { lines, logger } = capture();
  const app = buildApp({ pool: db.pool, logger });
  try {
    const res = await app.inject({ method: 'GET', url: '/v1/markets' });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(Object.keys(res.json()).sort(), ['code', 'message', 'requestId']);
    assert.equal(res.json().message, 'Internal server error');
    assert.ok(!res.body.includes('relation'));
    assert.ok(!lines.join('').includes('relation'), 'SQL error text must not reach logs');
  } finally {
    await app.close();
    await db.drop();
  }
});

test('/health reports database reachability', async () => {
  const db = await createTestDb();
  const app = buildApp({ pool: db.pool });
  const down = createPool({ databaseUrl: 'postgres://nobody:nothing@127.0.0.1:1/none' });
  const downApp = buildApp({ pool: down });
  try {
    const ok = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.json(), { status: 'ok', database: 'ok' });
    const unavailable = await downApp.inject({ method: 'GET', url: '/health' });
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.json(), { status: 'unavailable', database: 'unavailable' });
    assert.equal(ok.headers['x-content-type-options'], 'nosniff');
  } finally {
    await app.close();
    await downApp.close();
    await down.end();
    await db.drop();
  }
});
