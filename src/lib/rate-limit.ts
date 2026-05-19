import type { Duration } from "@upstash/ratelimit";

// ─── Upstash Redis (production) ──────────────────────────────────────────────
function createUpstashRatelimiter() {
  const { Ratelimit } = require("@upstash/ratelimit") as typeof import("@upstash/ratelimit");
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
  });

  const apiRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m" as Duration),
    prefix: "ratelimit:api",
  });

  const aiRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m" as Duration),
    prefix: "ratelimit:ai",
  });

  const publicRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m" as Duration),
    prefix: "ratelimit:public",
  });

  return { apiRateLimit, aiRateLimit, publicRateLimit };
}

// ─── In-Memory Fallback (dev / no Upstash) ───────────────────────────────────
function createMemoryRatelimiter() {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const cleanup = () => {
    const now = Date.now();
    windows.forEach((entry, key) => {
      if (entry.resetAt <= now) windows.delete(key);
    });
  };

  const check = (key: string, limit: number, windowMs: number) => {
    cleanup();
    const now = Date.now();
    const entry = windows.get(key);
    if (!entry || entry.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return { success: true, remaining: limit - 1, reset: now + windowMs };
    }
    if (entry.count >= limit) {
      return { success: false, remaining: 0, reset: entry.resetAt };
    }
    entry.count++;
    return { success: true, remaining: limit - entry.count, reset: entry.resetAt };
  };

  const WINDOW_1M = 60_000;

  const apiRateLimit = async (identifier: string) => check(`api:${identifier}`, 100, WINDOW_1M);
  const aiRateLimit = async (identifier: string) => check(`ai:${identifier}`, 20, WINDOW_1M);
  const publicRateLimit = async (identifier: string) => check(`public:${identifier}`, 30, WINDOW_1M);

  return { apiRateLimit, aiRateLimit, publicRateLimit };
}

// ─── Unified Interface ───────────────────────────────────────────────────────
type RateLimitResult = { success: boolean; remaining: number; reset: number };

interface RateLimiter {
  apiRateLimit: (identifier: string) => Promise<RateLimitResult>;
  aiRateLimit: (identifier: string) => Promise<RateLimitResult>;
  publicRateLimit: (identifier: string) => Promise<RateLimitResult>;
}

let limiter: RateLimiter;

function getLimiter(): RateLimiter {
  if (limiter) return limiter;
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    const upstash = createUpstashRatelimiter();
    limiter = {
      apiRateLimit: async (identifier: string) => {
        const result = await upstash.apiRateLimit.limit(identifier);
        return { success: result.success, remaining: result.remaining, reset: result.reset };
      },
      aiRateLimit: async (identifier: string) => {
        const result = await upstash.aiRateLimit.limit(identifier);
        return { success: result.success, remaining: result.remaining, reset: result.reset };
      },
      publicRateLimit: async (identifier: string) => {
        const result = await upstash.publicRateLimit.limit(identifier);
        return { success: result.success, remaining: result.remaining, reset: result.reset };
      },
    };
  } else {
    limiter = createMemoryRatelimiter();
  }
  return limiter;
}

export { getLimiter };
export type { RateLimitResult, RateLimiter };
