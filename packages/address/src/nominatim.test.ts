import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import { NominatimGeocoder, nominatimSearchUrl, nominatimUserAgent, type DeliveryAddress, type NominatimLogEntry } from './index.ts';

type Recording = { recordedFrom: string; query: Record<string, string>; status: number; body: unknown };
const recording = (name: string): Recording => JSON.parse(readFileSync(new URL(`./recorded/nominatim/${name}.json`, import.meta.url), 'utf8'));

const house = recording('house');
const street = recording('street');
const postcode = recording('postcode');
const empty = recording('empty');

const addressOf = (r: Recording): DeliveryAddress => ({
  countryCode: r.query.countrycodes.toUpperCase(),
  postalCode: r.query.postalcode,
  addressLine1: r.query.street,
  city: r.query.city,
});

type Route = (req: IncomingMessage, res: ServerResponse) => void;
const requests: { url: URL; headers: IncomingMessage['headers'] }[] = [];
let route: Route = (_req, res) => res.writeHead(500).end();
let baseUrl = '';
const server = createServer((req, res) => {
  requests.push({ url: new URL(req.url ?? '/', 'http://localhost'), headers: req.headers });
  route(req, res);
});

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/nominatim`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

const json = (status: number, body: unknown): Route => (_req, res) => res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
const replay = (r: Recording) => json(r.status, r.body);

function geocoder(log?: NominatimLogEntry[]) {
  requests.length = 0;
  return new NominatimGeocoder({ baseUrl, timeoutMs: 300, log: log && ((entry) => log.push(entry)) });
}

test('a recorded house-level answer maps to found with address precision', async () => {
  route = replay(house);
  const result = await geocoder().geocode(addressOf(house));
  const hit = (house.body as { lat: string; lon: string }[])[0];
  assert.deepEqual(result, { status: 'found', point: { lat: Number(hit.lat), lng: Number(hit.lon) }, precision: 'address' });
});

test('the request carries only the structured fields, the market, jsonv2 and limit 1, with a generic User-Agent', async () => {
  route = replay(house);
  const address = { ...addressOf(house), addressLine2: 'Wohnung 4', instructions: 'Bitte klingeln' };
  await geocoder().geocode(address);
  const [{ url, headers }] = requests;
  assert.equal(url.pathname, '/nominatim/search');
  assert.deepEqual(Object.fromEntries(url.searchParams), { ...house.query, format: 'jsonv2', addressdetails: '1', limit: '1' });
  assert.ok(!url.search.includes('Wohnung') && !url.search.includes('klingeln'));
  assert.equal(headers['user-agent'], nominatimUserAgent);
  assert.match(nominatimUserAgent, /^tazumo-address-geocoder\/[\d.]+ \([^@]*\)$/);
  assert.equal(headers.cookie, undefined);
  assert.equal(nominatimSearchUrl('https://geo.internal/', addressOf(house)).href.startsWith('https://geo.internal/search?'), true);
});

test('recorded street-level and postcode-level answers keep their precision', async () => {
  route = replay(street);
  const s = await geocoder().geocode(addressOf(street));
  assert.ok(s.status === 'found' && s.precision === 'street', JSON.stringify(s));
  route = replay(postcode);
  const p = await geocoder().geocode(addressOf(house));
  assert.ok(p.status === 'found' && p.precision === 'postal_code', JSON.stringify(p));
});

test('empty, coarse and other-country answers are not_found', async () => {
  route = replay(empty);
  assert.deepEqual(await geocoder().geocode(addressOf(empty)), { status: 'not_found' });
  const hit = (house.body as Record<string, unknown>[])[0];
  route = json(200, [{ ...hit, place_rank: 16, addresstype: 'city', type: 'city' }]);
  assert.deepEqual(await geocoder().geocode(addressOf(house)), { status: 'not_found' });
  route = json(200, [{ ...hit, address: { ...(hit.address as object), country_code: 'pl' } }]);
  assert.deepEqual(await geocoder().geocode(addressOf(house)), { status: 'not_found' });
});

test('provider failures are unavailable, never not_found', async () => {
  const hit = (house.body as Record<string, unknown>[])[0];
  const cases: [string, Route][] = [
    ['500', json(500, { error: 'boom' })],
    ['429', json(429, [])],
    ['400', json(400, { error: { code: 400 } })],
    ['html', (_q, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<html></html>')],
    ['broken json', (_q, res) => res.writeHead(200, { 'content-type': 'application/json' }).end('[{"lat":')],
    ['object body', json(200, { lat: '1', lon: '2' })],
    ['bad coordinates', json(200, [{ ...hit, lat: '95.0' }])],
    ['numeric coordinates', json(200, [{ ...hit, lat: 53.07, lon: 8.8 }])],
    ['oversized', json(200, [{ ...hit, padding: 'x'.repeat(70_000) }])],
    ['redirect', (_q, res) => res.writeHead(302, { location: 'https://example.org/search' }).end()],
    ['timeout', () => undefined],
    ['reset', (req) => req.socket.destroy()],
  ];
  for (const [name, handler] of cases) {
    route = handler;
    assert.deepEqual(await geocoder().geocode(addressOf(house)), { status: 'unavailable' }, name);
  }
  const offline = new NominatimGeocoder({ baseUrl: 'http://127.0.0.1:9/', timeoutMs: 300 });
  assert.deepEqual(await offline.geocode(addressOf(house)), { status: 'unavailable' });
});

test('unsupported countries never trigger a request', async () => {
  route = replay(house);
  const g = geocoder();
  assert.deepEqual(await g.geocode({ ...addressOf(house), countryCode: 'PL' }), { status: 'not_found' });
  assert.equal(requests.length, 0);
});

test('log entries carry only the redacted address and the outcome', async () => {
  const log: NominatimLogEntry[] = [];
  route = replay(house);
  await geocoder(log).geocode(addressOf(house));
  route = json(503, {});
  await geocoder(log).geocode(addressOf(house));
  await geocoder(log).geocode({ ...addressOf(house), countryCode: 'PL' });
  assert.deepEqual(log.map(({ outcome, reason, httpStatus }) => [outcome, reason, httpStatus]), [
    ['found', undefined, undefined],
    ['unavailable', 'http_status', 503],
    ['not_found', 'unsupported_country', undefined],
  ]);
  const text = JSON.stringify(log);
  for (const secret of [house.query.street, house.query.city, house.query.street.match(/\d+/)?.[0] ?? '']) {
    assert.ok(!text.includes(secret), secret);
  }
  assert.equal(log[0].address, `DE ${house.query.postalcode.slice(0, 2)}***`);
});

test('invalid configuration is rejected', () => {
  for (const url of ['ftp://geo.internal/', 'https://user:pw@geo.internal/', 'https://geo.internal/?key=1', 'https://geo.internal/#x', 'geo.internal', 'https://nominatim.openstreetmap.org/']) {
    assert.throws(() => new NominatimGeocoder({ baseUrl: url }), TypeError, url);
  }
  for (const timeoutMs of [0, 50, 10_001, 1.5]) assert.throws(() => new NominatimGeocoder({ baseUrl: 'https://geo.internal/', timeoutMs }), RangeError);
});
