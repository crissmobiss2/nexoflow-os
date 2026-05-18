import { ilike, or, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { knowledgeSnippets } from "../db/schema";

export const knowledgeRouter = createTRPCRouter({
  // Get all unique categories with snippet counts
  categories: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        category: knowledgeSnippets.category,
        count: sql<number>`count(*)::int`,
      })
      .from(knowledgeSnippets)
      .groupBy(knowledgeSnippets.category)
      .orderBy(sql`count(*) desc`);
    return rows;
  }),

  // Search snippets by query + optional category filter
  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, category, limit, offset } = input;

      const conditions = [];

      if (query.trim()) {
        conditions.push(
          or(
            ilike(knowledgeSnippets.name, `%${query}%`),
            ilike(knowledgeSnippets.content, `%${query}%`),
          ),
        );
      }

      if (category) {
        conditions.push(eq(knowledgeSnippets.category, category));
      }

      const where = conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : sql`${conditions[0]} AND ${conditions[1]}`
        : undefined;

      const [results, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(knowledgeSnippets)
          .where(where)
          .orderBy(knowledgeSnippets.name)
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ total: sql<number>`count(*)::int` })
          .from(knowledgeSnippets)
          .where(where),
      ]);

      return {
        snippets: results,
        total: countResult[0]?.total ?? 0,
      };
    }),

  // Get snippets by category (for context injection)
  byCategory: publicProcedure
    .input(
      z.object({
        categories: z.array(z.string()),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.categories.length === 0) return [];

      return ctx.db
        .select()
        .from(knowledgeSnippets)
        .where(
          sql`${knowledgeSnippets.category} = ANY(${input.categories})`,
        )
        .orderBy(knowledgeSnippets.category, knowledgeSnippets.name)
        .limit(input.limit);
    }),

  // Get a single snippet by id
  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.knowledgeSnippets.findFirst({
        where: eq(knowledgeSnippets.id, input.id),
      });
    }),

  // Stats
  stats: publicProcedure.query(async ({ ctx }) => {
    const [countResult] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        categories: sql<number>`count(distinct ${knowledgeSnippets.category})::int`,
      })
      .from(knowledgeSnippets);
    return countResult ?? { total: 0, categories: 0 };
  }),
});
