import { TRPCError } from "@trpc/server";
import { getLimiter } from "@/lib/rate-limit";
import type { TRPCContext } from "../trpc";

type IdentifierType = "user" | "ip" | "key";

interface RateLimitOptions {
  /** Which rate limiter to use */
  limiter: "api" | "ai" | "public";
  /** How to identify the requester */
  identifierType?: IdentifierType;
  /** Custom identifier (overrides auto-detection) */
  customIdentifier?: string;
}

/**
 * tRPC middleware that checks rate limits before allowing the request through.
 *
 * Usage:
 * ```
 * export const rateLimitedProcedure = publicProcedure.use(rateLimitMiddleware({ limiter: "api" }));
 * export const aiRateLimitedProcedure = publicProcedure.use(rateLimitMiddleware({ limiter: "ai" }));
 * ```
 */
export function rateLimitMiddleware(opts: RateLimitOptions) {
  return async (trpcOpts: {
    ctx: TRPCContext;
    next: () => Promise<unknown>;
    path: string;
    type: string;
    input: unknown;
  }) => {
    const { limiter: limiterType, identifierType = "user", customIdentifier } = opts;
    const ratelimit = getLimiter();

    // Determine the identifier
    let identifier: string;

    if (customIdentifier) {
      identifier = customIdentifier;
    } else if (identifierType === "ip") {
      // Try to get IP from headers
      const forwarded = trpcOpts.ctx.req?.headers?.get("x-forwarded-for");
      const realIp = trpcOpts.ctx.req?.headers?.get("x-real-ip");
      identifier = forwarded?.split(",")[0]?.trim() ?? realIp ?? "unknown-ip";
    } else if (identifierType === "key") {
      const apiKey = trpcOpts.ctx.req?.headers?.get("x-api-key");
      identifier = apiKey ?? "unknown-key";
    } else {
      // Default: use user/request IP as fallback
      const forwarded = trpcOpts.ctx.req?.headers?.get("x-forwarded-for");
      const realIp = trpcOpts.ctx.req?.headers?.get("x-real-ip");
      identifier = forwarded?.split(",")[0]?.trim() ?? realIp ?? "anonymous";
    }

    // Select the right limiter
    let result: { success: boolean; remaining: number; reset: number };

    switch (limiterType) {
      case "ai":
        result = await ratelimit.aiRateLimit(identifier);
        break;
      case "public":
        result = await ratelimit.publicRateLimit(identifier);
        break;
      case "api":
      default:
        result = await ratelimit.apiRateLimit(identifier);
        break;
    }

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
    }

    return trpcOpts.next();
  };
}
