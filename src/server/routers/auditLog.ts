import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { auditLogs } from "../db/schema";

export const auditLogRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        action: z.string().optional(),
        userId: z.string().optional(),
        targetType: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, action, userId, targetType } = input;
      const conditions = [];

      if (action) {
        conditions.push(eq(auditLogs.action, action));
      }
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId));
      }
      if (targetType) {
        conditions.push(eq(auditLogs.targetType, targetType));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [results, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(auditLogs)
          .where(where)
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ total: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(where),
      ]);

      return {
        logs: results,
        total: countResult[0]?.total ?? 0,
      };
    }),

  // Get distinct actions for filter dropdown
  distinctActions: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .groupBy(auditLogs.action)
      .orderBy(auditLogs.action);
    return rows.map((r) => r.action);
  }),

  // Get distinct target types for filter dropdown
  distinctTargetTypes: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ targetType: auditLogs.targetType })
      .from(auditLogs)
      .groupBy(auditLogs.targetType)
      .orderBy(auditLogs.targetType);
    return rows.map((r) => r.targetType);
  }),

  // Get distinct users for filter dropdown
  distinctUsers: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        userId: auditLogs.userId,
        userName: auditLogs.userName,
      })
      .from(auditLogs)
      .groupBy(auditLogs.userId, auditLogs.userName)
      .orderBy(auditLogs.userName);
    return rows.filter((r) => r.userId);
  }),
});
