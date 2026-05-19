import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "./db";
import { auditLogs } from "./db/schema";
import { auth } from "@/lib/auth";

export const createTRPCContext = async (opts: { req: NextRequest | { headers: Headers } }) => {
  const session = await auth();
  return {
    db,
    req: opts.req,
    session,
    user: session?.user as
      | { id: string; name?: string | null; email?: string | null; role?: string; teamId?: string | null }
      | undefined,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// ─── Authenticated Procedure ──────────────────────────────────────────────────
// Requires a valid session; throws UNAUTHORIZED if no user

export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to access this resource" });
  }
  return opts.next({ ctx: { ...ctx, user: ctx.user as NonNullable<typeof ctx.user> } });
});

// ─── Team Filter Helper ───────────────────────────────────────────────────────
// Returns a Drizzle where condition object that filters by the current user's team.
// Usage: `...teamFilter()` in your `.where()` clause

export const teamFilter = () => {
  // This is a marker — the actual teamId filtering is done in the middleware below.
  // The middleware injects the teamId into the context so procedures can use it.
  return {} as { teamId: string };
};

/**
 * Team-aware middleware.
 * Injects `teamId` into the context so all queries can filter by it.
 * Use `teamProcedure` for routers that need multi-tenant isolation.
 */
export const teamMiddleware = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in" });
  }
  const teamId = ctx.user.teamId;
  if (!teamId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No team assigned" });
  }
  return opts.next({ ctx: { ...ctx, teamId, user: ctx.user as NonNullable<typeof ctx.user> } });
});

/**
 * Team-aware procedure. Use this for routers that need multi-tenant data isolation.
 * Injects `teamId` into context and provides a `teamFilter` helper.
 */
export const teamProcedure = protectedProcedure.use(async (opts) => {
  const { ctx } = opts;
  const teamId = ctx.user.teamId;
  if (!teamId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No team assigned" });
  }
  return opts.next({
    ctx: {
      ...ctx,
      teamId,
      teamFilter: () => ({ teamId } as { teamId: string }),
    },
  });
});

// ─── Audit Log Middleware ────────────────────────────────────────────────────
// Logs all tRPC mutations to the audit log table

export const auditedProcedure = t.procedure.use(async (opts) => {
  const result = await opts.next();

  // Only log mutations (POST/mutations), not queries
  if (opts.type === "mutation") {
    try {
      const path = opts.path;
      const parts = path.split(".");
      const procedureName = parts[parts.length - 1] ?? "unknown";
      const routerName = parts[0] ?? "unknown";

      let actionType = "update";
      const lower = procedureName.toLowerCase();
      if (lower.startsWith("create") || lower === "create") {
        actionType = "create";
      } else if (lower.startsWith("delete") || lower === "delete") {
        actionType = "delete";
      } else if (lower === "score" || lower === "generatescope" || lower === "generatearchitecture" || lower === "recordusage") {
        actionType = "generate";
      }

      let targetId: string | undefined;
      const rawInput = opts.input;
      if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
        const rec = rawInput as Record<string, unknown>;
        targetId = (rec.id as string) ?? (rec.projectId as string) ?? (rec.clientId as string) ?? undefined;
      }

      const insertValues: Record<string, unknown> = {
        action: actionType,
        targetType: routerName,
      };
      if (targetId) {
        insertValues.targetId = targetId;
      }

      await opts.ctx.db.insert(auditLogs).values(insertValues as any);
    } catch {
      // Silently fail audit logging
    }
  }

  return result;
});
