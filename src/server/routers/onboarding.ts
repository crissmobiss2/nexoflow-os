import { eq, desc, and, asc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { onboardingTasks, clients, users } from "../db/schema";

const DEFAULT_CHECKLIST = [
  { title: "Collect signed contract / proposal", category: "docs", orderVal: 1 },
  { title: "Send welcome email with portal access", category: "setup", orderVal: 2 },
  { title: "Schedule kick-off call", category: "kickoff", orderVal: 3 },
  { title: "Create project in NexoFlow OS", category: "setup", orderVal: 4 },
  { title: "Set up Slack channel with client", category: "setup", orderVal: 5 },
  { title: "Send first invoice (30% kickoff)", category: "billing", orderVal: 6 },
  { title: "Share project portal link with client", category: "setup", orderVal: 7 },
  { title: "Collect requirements document", category: "docs", orderVal: 8 },
  { title: "Confirm timeline and milestones", category: "kickoff", orderVal: 9 },
  { title: "Add client to email newsletter", category: "setup", orderVal: 10 },
];

export const onboardingRouter = createTRPCRouter({
  listByClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          task: onboardingTasks,
          assigneeName: users.name,
        })
        .from(onboardingTasks)
        .leftJoin(users, eq(onboardingTasks.assigneeId, users.id))
        .where(eq(onboardingTasks.clientId, input.clientId))
        .orderBy(asc(onboardingTasks.orderVal));
    }),

  seed: protectedProcedure
    .input(z.object({ clientId: z.string().uuid(), projectId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: onboardingTasks.id })
        .from(onboardingTasks)
        .where(eq(onboardingTasks.clientId, input.clientId));
      if (existing.length > 0) return { seeded: false, count: existing.length };

      const rows = DEFAULT_CHECKLIST.map((t) => ({
        ...t,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
      }));
      await ctx.db.insert(onboardingTasks).values(rows);
      return { seeded: true, count: rows.length };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(["todo", "in_progress", "done", "skipped"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(onboardingTasks)
        .set({
          status: input.status,
          completedAt: input.status === "done" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(onboardingTasks.id, input.id))
        .returning();
      return updated;
    }),

  create: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
      assigneeId: z.string().optional(),
      dueDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db.insert(onboardingTasks).values(input).returning();
      return task;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(onboardingTasks).where(eq(onboardingTasks.id, input.id));
      return { success: true };
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const all = await ctx.db
      .select({
        clientId: onboardingTasks.clientId,
        status: onboardingTasks.status,
      })
      .from(onboardingTasks);

    const byClient: Record<string, { total: number; done: number }> = {};
    for (const row of all) {
      if (!byClient[row.clientId]) byClient[row.clientId] = { total: 0, done: 0 };
      byClient[row.clientId]!.total++;
      if (row.status === "done") byClient[row.clientId]!.done++;
    }
    return byClient;
  }),
});
