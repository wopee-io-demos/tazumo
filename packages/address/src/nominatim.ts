import { isAddressMarket, type DeliveryAddress } from './address.ts';
import type { GeocodePrecision, GeocodeResult, Geocoder } from './geocoder.ts';
import { redactAddress } from './redact.ts';

export const nominatimUserAgent = 'tazumo-address-geocoder/0.1 (self-hosted Nominatim client)';
export const nominatimDefaultTimeoutMs = 2_000;
export const nominatimMaxResponseBytes = 64 * 1024;

export type NominatimLogEntry = {
  event: 'geocode';
  outcome: GeocodeResult['status'];
  reason?: 'unsupported_country' | 'timeout' | 'network' | 'http_status' | 'content_type' | 'too_large' | 'malformed' | 'coarse' | 'country_mismatch';
  httpStatus?: number;
  address: string;
  durationMs: number;
};

export type NominatimOptions = {
  baseUrl: string;
  timeoutMs?: number;
  userAgent?: string;
  fetch?: typeof fetch;
  log?: (entry: NominatimLogEntry) => void;
  now?: () => number;
};

export type NominatimOutcome = { result: GeocodeResult; reason?: NominatimLogEntry['reason']; httpStatus?: number };

const unavailable = (reason: NominatimLogEntry['reason'], httpStatus?: number): NominatimOutcome => ({ result: { status: 'unavailable' }, reason, httpStatus });
const notFound = (reason?: NominatimLogEntry['reason']): NominatimOutcome => ({ result: { status: 'not_found' }, reason });

function parseBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('Nominatim baseUrl must be an absolute http(s) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new TypeError('Nominatim baseUrl must be http(s) without credentials, query or fragment');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

/** Structured search for one address, restricted to the address's own market. `addressLine2` and instructions are never sent. */
export function nominatimSearchUrl(baseUrl: string | URL, address: DeliveryAddress): URL {
  const url = new URL('search', typeof baseUrl === 'string' ? parseBaseUrl(baseUrl) : baseUrl);
  url.search = new URLSearchParams({
    street: address.addressLine1,
    city: address.city,
    postalcode: address.postalCode,
    countrycodes: address.countryCode.toLowerCase(),
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
  }).toString();
  return url;
}

function precisionOf(hit: Record<string, unknown>): GeocodePrecision | undefined {
  if (hit.addresstype === 'postcode' || hit.type === 'postcode') return 'postal_code';
  const rank = Number(hit.place_rank);
  if (rank >= 28) return 'address';
  if (rank >= 26) return 'street';
  return undefined;
}

/** Maps a Nominatim jsonv2 body to a result. Anything unexpected is `unavailable`, never a guess. */
export function parseNominatimResponse(body: unknown, address: DeliveryAddress): NominatimOutcome {
  if (!Array.isArray(body)) return unavailable('malformed');
  if (body.length === 0) return notFound();
  const hit = body[0];
  if (typeof hit !== 'object' || hit === null) return unavailable('malformed');
  const record = hit as Record<string, unknown>;
  const lat = typeof record.lat === 'string' ? Number(record.lat) : NaN;
  const lng = typeof record.lon === 'string' ? Number(record.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return unavailable('malformed');
  const country = (record.address as Record<string, unknown> | undefined)?.country_code;
  if (typeof country !== 'string' || country.toUpperCase() !== address.countryCode) return notFound('country_mismatch');
  const precision = precisionOf(record);
  if (!precision) return notFound('coarse');
  return { result: { status: 'found', point: { lat, lng }, precision } };
}

async function readLimited(response: Response, limit: number): Promise<string | undefined> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Server-side `Geocoder` adapter for a self-hosted Nominatim (ADR-0023), imported from `@tazumo/address/nominatim`. Refuses any openstreetmap.org host. */
export class NominatimGeocoder implements Geocoder {
  readonly #baseUrl: URL;
  readonly #timeoutMs: number;
  readonly #userAgent: string;
  readonly #fetch: typeof fetch;
  readonly #log?: (entry: NominatimLogEntry) => void;
  readonly #now: () => number;

  constructor(options: NominatimOptions) {
    this.#baseUrl = parseBaseUrl(options.baseUrl);
    const host = this.#baseUrl.hostname.replace(/\.$/, '').toLowerCase();
    if (host === 'openstreetmap.org' || host.endsWith('.openstreetmap.org')) throw new TypeError('The public Nominatim usage policy forbids this use; configure a self-hosted instance');
    const timeoutMs = options.timeoutMs ?? nominatimDefaultTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) throw new RangeError('timeoutMs must be an integer between 100 and 10000');
    this.#timeoutMs = timeoutMs;
    this.#userAgent = options.userAgent ?? nominatimUserAgent;
    this.#fetch = options.fetch ?? fetch;
    this.#log = options.log;
    this.#now = options.now ?? Date.now;
  }

  async geocode(address: DeliveryAddress): Promise<GeocodeResult> {
    const started = this.#now();
    const outcome = isAddressMarket(address.countryCode) ? await this.#request(address) : notFound('unsupported_country');
    try {
      this.#log?.({
        event: 'geocode',
        outcome: outcome.result.status,
        ...(outcome.reason && { reason: outcome.reason }),
        ...(outcome.httpStatus !== undefined && { httpStatus: outcome.httpStatus }),
        address: redactAddress(address),
        durationMs: this.#now() - started,
      });
    } catch {
      // A failing log sink must not change the geocoding result.
    }
    return outcome.result;
  }

  async #request(address: DeliveryAddress): Promise<NominatimOutcome> {
    const signal = AbortSignal.timeout(this.#timeoutMs);
    try {
      const response = await this.#fetch(nominatimSearchUrl(this.#baseUrl, address), {
        headers: { 'User-Agent': this.#userAgent, Accept: 'application/json' },
        redirect: 'error',
        signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        return unavailable('http_status', response.status);
      }
      if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) {
        await response.body?.cancel();
        return unavailable('content_type', response.status);
      }
      const text = await readLimited(response, nominatimMaxResponseBytes);
      if (text === undefined) return unavailable('too_large');
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return unavailable('malformed');
      }
      return parseNominatimResponse(body, address);
    } catch {
      return unavailable(signal.aborted ? 'timeout' : 'network');
    }
  }
}
