import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { timeEntries, projects, users } from "../db/schema";

export const timeTrackingRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid().optional(),
      userId: z.string().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.projectId) conditions.push(eq(timeEntries.projectId, input.projectId));
      if (input?.userId) conditions.push(eq(timeEntries.userId, input.userId));
      if (input?.from) conditions.push(gte(timeEntries.date, input.from));
      if (input?.to) conditions.push(lte(timeEntries.date, input.to));

      return ctx.db
        .select({
          entry: timeEntries,
          projectName: projects.name,
          userName: users.name,
        })
        .from(timeEntries)
        .leftJoin(projects, eq(timeEntries.projectId, projects.id))
        .leftJoin(users, eq(timeEntries.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(timeEntries.date));
    }),

  stats: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const condition = input?.projectId ? eq(timeEntries.projectId, input.projectId) : undefined;
      const [row] = await ctx.db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(minutes_logged), 0)::int`,
          billableMinutes: sql<number>`COALESCE(SUM(CASE WHEN billable THEN minutes_logged ELSE 0 END), 0)::int`,
          entryCount: sql<number>`COUNT(*)::int`,
        })
        .from(timeEntries)
        .where(condition);
      return row ?? { totalMinutes: 0, billableMinutes: 0, entryCount: 0 };
    }),

  byProject: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        projectId: timeEntries.projectId,
        projectName: projects.name,
        totalMinutes: sql<number>`COALESCE(SUM(minutes_logged), 0)::int`,
        billableMinutes: sql<number>`COALESCE(SUM(CASE WHEN billable THEN minutes_logged ELSE 0 END), 0)::int`,
      })
      .from(timeEntries)
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .groupBy(timeEntries.projectId, projects.name)
      .orderBy(desc(sql`SUM(minutes_logged)`));
  }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      date: z.date(),
      minutesLogged: z.number().int().min(1).max(1440),
      description: z.string().optional(),
      billable: z.boolean().default(true),
      ratePerHourCents: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .insert(timeEntries)
        .values({
          ...input,
          userId: ctx.session.user.id,
        })
        .returning();
      return entry;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      minutesLogged: z.number().int().min(1).max(1440).optional(),
      description: z.string().optional(),
      billable: z.boolean().optional(),
      date: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(timeEntries)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(timeEntries.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(timeEntries).where(eq(timeEntries.id, input.id));
      return { success: true };
    }),
});
