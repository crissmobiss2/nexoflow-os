import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "./db";
import { auditLogs } from "./db/schema";

export const createTRPCContext = async (opts: { req: NextRequest | { headers: Headers } }) => {
  return { db, req: opts.req };
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

// ─── Audit Log Middleware ────────────────────────────────────────────────────
// Logs all tRPC mutations to the audit log table

export const auditedProcedure = t.procedure.use(async (opts) => {
  const result = await opts.next();

  // Only log mutations (POST/mutations), not queries
  if (opts.type === "mutation") {
    try {
      const path = opts.path; // e.g. "projects.create"
      const parts = path.split(".");
      const procedureName = parts[parts.length - 1] ?? "unknown";
      const routerName = parts[0] ?? "unknown";

      // Determine the action type from the procedure name
      let actionType = "update";
      const lower = procedureName.toLowerCase();
      if (lower.startsWith("create") || lower === "create") {
        actionType = "create";
      } else if (lower.startsWith("delete") || lower === "delete") {
        actionType = "delete";
      } else if (lower === "score" || lower === "generatescope" || lower === "generatearchitecture" || lower === "recordusage") {
        actionType = "generate";
      }

      // Try to determine target ID from input (handle UnsetMarker)
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
      // Silently fail audit logging — should not break the main operation
    }
  }

  return result;
});
