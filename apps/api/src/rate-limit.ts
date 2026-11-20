import { isIPv6 } from 'node:net';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { apiError } from './errors.ts';

export type LimitRule = { limit: number; windowMs: number };
export type RateLimitOptions = { ip?: LimitRule; principal?: LimitRule; now?: () => number; maxKeys?: number };

export const defaultLimits = {
  ip: { limit: 300, windowMs: 60_000 },
  principal: { limit: 120, windowMs: 60_000 }
} satisfies Record<'ip' | 'principal', LimitRule>;

type Decision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class FixedWindowLimiter {
  readonly rule: LimitRule;
  readonly #now: () => number;
  readonly #maxKeys: number;
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(rule: LimitRule, now: () => number = Date.now, maxKeys = 100_000) {
    this.rule = rule;
    this.#now = now;
    this.#maxKeys = maxKeys;
  }

  get size() {
    return this.#windows.size;
  }

  hit(key: string): Decision {
    const now = this.#now();
    this.#sweep(now);
    let window = this.#windows.get(key);
    if (!window || now - window.start >= this.rule.windowMs) {
      this.#windows.delete(key);
      if (this.#windows.size >= this.#maxKeys) return { allowed: false, retryAfterSeconds: this.#retryAfter(this.#oldestStart(), now) };
      window = { start: now, count: 0 };
      this.#windows.set(key, window);
    }
    window.count++;
    if (window.count <= this.rule.limit) return { allowed: true };
    return { allowed: false, retryAfterSeconds: this.#retryAfter(window.start, now) };
  }

  #retryAfter(start: number, now: number) {
    return Math.max(1, Math.ceil((start + this.rule.windowMs - now) / 1000));
  }

  #oldestStart() {
    return this.#windows.values().next().value?.start ?? this.#now();
  }

  #sweep(now: number) {
    for (const [key, window] of this.#windows) {
      if (now - window.start < this.rule.windowMs) break;
      this.#windows.delete(key);
    }
  }
}

function expandIPv6(address: string): string[] {
  const [head, tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = address.includes('::') ? (tail ? tail.split(':') : []) : [];
  return [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
}

export function clientKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!isIPv6(ip)) return ip;
  return `${expandIPv6(ip.toLowerCase()).slice(0, 4).map((part) => part.padStart(4, '0')).join(':')}::/64`;
}

function hook(limiter: FixedWindowLimiter, key: (request: FastifyRequest) => string) {
  return async function rateLimit(request: FastifyRequest, reply: FastifyReply) {
    const result = limiter.hit(key(request));
    if (result.allowed) return;
    request.log.warn({ limit: limiter.rule.limit, windowMs: limiter.rule.windowMs }, 'rate limited');
    reply.header('retry-after', String(result.retryAfterSeconds));
    return reply.code(429).send(apiError(request, 'rate_limited', 'Too many requests'));
  };
}

export function createRateLimits(options: RateLimitOptions = {}) {
  const ip = new FixedWindowLimiter(options.ip ?? defaultLimits.ip, options.now, options.maxKeys);
  const principal = new FixedWindowLimiter(options.principal ?? defaultLimits.principal, options.now, options.maxKeys);
  return {
    byIp: hook(ip, (request) => `ip:${clientKey(request.ip)}`),
    byPrincipal: hook(principal, (request) => `principal:${request.principal?.userId ?? 'none'}`)
  };
}
