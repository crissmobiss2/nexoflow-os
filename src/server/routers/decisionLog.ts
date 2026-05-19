import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { decisionLog } from "../db/schema";

const decisionLogInput = z.object({
  declNumber: z.string().min(1).regex(/^DECL-\d{3,}$/, "Must match DECL-XXX format"),
  title: z.string().min(1),
  status: z.enum(["proposed", "accepted", "deprecated", "superseded"]).default("proposed"),
  affectedStandards: z.array(z.string()).optional().default([]),
  affectedMocs: z.array(z.string()).optional().default([]),
  context: z.string().optional(),
  decision: z.string().min(1),
  consequences: z.string().optional(),
  date: z.string().datetime().optional(),
});

export const decisionLogRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["proposed", "accepted", "deprecated", "superseded"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const { status, limit, offset } = input;
      const conditions = [];
      if (status) {
        conditions.push(eq(decisionLog.status, status));
      }

      const where = conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : sql`${conditions[0]} AND ${conditions[1]}`
        : undefined;

      const [results, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(decisionLog)
          .where(where)
          .orderBy(desc(decisionLog.date))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ total: sql<number>`count(*)::int` })
          .from(decisionLog)
          .where(where),
      ]);

      return {
        decisions: results,
        total: countResult[0]?.total ?? 0,
      };
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.decisionLog.findFirst({
        where: eq(decisionLog.id, input.id),
      });
    }),

  getByDeclNumber: publicProcedure
    .input(z.object({ declNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.decisionLog.findFirst({
        where: eq(decisionLog.declNumber, input.declNumber),
      });
    }),

  create: publicProcedure
    .input(decisionLogInput)
    .mutation(async ({ ctx, input }) => {
      const [decl] = await ctx.db
        .insert(decisionLog)
        .values({
          ...input,
          date: input.date ? new Date(input.date) : new Date(),
        })
        .returning();
      return decl;
    }),

  update: publicProcedure
    .input(
      decisionLogInput.partial().extend({ id: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [decl] = await ctx.db
        .update(decisionLog)
        .set({
          ...data,
          date: data.date ? new Date(data.date) : undefined,
        })
        .where(eq(decisionLog.id, id))
        .returning();
      return decl;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(decisionLog).where(eq(decisionLog.id, input.id));
      return { success: true };
    }),

  // Get decisions relevant to a project type/domain
  byAffected: publicProcedure
    .input(
      z.object({
        categories: z.array(z.string()),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.categories.length === 0) return [];

      // Search for decisions where affectedStandards or affectedMocs overlap with input categories
      const conditions = input.categories.map(
        (cat) => sql`${decisionLog.affectedStandards} && ARRAY[${cat}]::text[]`,
      );
      const mocsConditions = input.categories.map(
        (cat) => sql`${decisionLog.affectedMocs} && ARRAY[${cat}]::text[]`,
      );
      const allConditions = [...conditions, ...mocsConditions];

      const where = allConditions.length > 0
        ? sql`(${allConditions.join(" OR ")})`
        : undefined;

      return ctx.db
        .select()
        .from(decisionLog)
        .where(where)
        .orderBy(desc(decisionLog.date))
        .limit(input.limit);
    }),
});
