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

  // Search snippets by query + optional category filter (ILIKE text search)
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

  // Semantic search using pgvector cosine distance
  semanticSearch: publicProcedure
    .input(
      z.object({
        embedding: z.array(z.number()),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { embedding, category, limit, offset } = input;

      const conditions: string[] = [];
      if (category) {
        conditions.push(`${knowledgeSnippets.category.name} = ${sql`${category}`}`);
      }

      // Use pgvector <-> distance operator for cosine distance
      const orderBySql = sql`${knowledgeSnippets.embedding} <-> ${embedding}::vector`;

      const whereClause = conditions.length > 0
        ? sql`${conditions.join(" AND ")}`
        : undefined;

      const [results, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(knowledgeSnippets)
          .where(whereClause)
          .orderBy(orderBySql)
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ total: sql<number>`count(*)::int` })
          .from(knowledgeSnippets)
          .where(whereClause),
      ]);

      return {
        snippets: results,
        total: countResult[0]?.total ?? 0,
      };
    }),

  // Hybrid search: combine ILIKE text search with vector similarity
  hybridSearch: publicProcedure
    .input(
      z.object({
        query: z.string(),
        embedding: z.array(z.number()),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).default(0),
        textWeight: z.number().min(0).max(1).default(0.3),
        semanticWeight: z.number().min(0).max(1).default(0.7),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, embedding, category, limit, offset, textWeight, semanticWeight } = input;

      // We do semantic search first, then merge with text search results
      // Use a larger limit for the candidate pool to merge from
      const poolLimit = Math.max(limit * 3, 50);

      // 1. Get semantic candidates
      const semanticConditions: string[] = [];
      if (category) {
        semanticConditions.push(`${knowledgeSnippets.category.name} = ${sql`${category}`}`);
      }
      const semanticWhere = semanticConditions.length > 0
        ? sql`${semanticConditions.join(" AND ")}`
        : undefined;

      const semanticResults = await ctx.db
        .select({
          id: knowledgeSnippets.id,
          category: knowledgeSnippets.category,
          name: knowledgeSnippets.name,
          content: knowledgeSnippets.content,
          distance: sql<number>`${knowledgeSnippets.embedding} <-> ${embedding}::vector`,
        })
        .from(knowledgeSnippets)
        .where(semanticWhere)
        .orderBy(sql`${knowledgeSnippets.embedding} <-> ${embedding}::vector`)
        .limit(poolLimit);

      // 2. Get text search candidates
      const textConditions = [];
      if (query.trim()) {
        textConditions.push(
          or(
            ilike(knowledgeSnippets.name, `%${query}%`),
            ilike(knowledgeSnippets.content, `%${query}%`),
          ),
        );
      }
      if (category) {
        textConditions.push(eq(knowledgeSnippets.category, category));
      }
      const textWhere = textConditions.length > 0
        ? textConditions.length === 1
          ? textConditions[0]
          : sql`${textConditions[0]} AND ${textConditions[1]}`
        : undefined;

      const textResults = await ctx.db
        .select()
        .from(knowledgeSnippets)
        .where(textWhere)
        .orderBy(knowledgeSnippets.name)
        .limit(poolLimit);

      // 3. Merge with weighted scoring
      // Build lookup by id for semantic distances
      const semanticMap = new Map<string, number>();
      const maxDistance = semanticResults.length > 0
        ? Math.max(...semanticResults.map((r) => r.distance))
        : 1;
      for (const r of semanticResults) {
        // Convert distance to similarity score (0-1), invert so closer = higher
        const similarity = 1 - (maxDistance > 0 ? r.distance / maxDistance : 0);
        semanticMap.set(r.id, similarity);
      }

      // Build scored map
      const scoredMap = new Map<string, { snippet: typeof textResults[0]; score: number }>();

      for (const r of textResults) {
        const semanticScore = semanticMap.get(r.id) ?? 0;
        const textScore = query.trim() ? 0.8 : 0; // text match gets base score
        const score = textScore * textWeight + semanticScore * semanticWeight;
        scoredMap.set(r.id, { snippet: r, score });
      }

      // Add any semantic-only results not in text results
      for (const r of semanticResults) {
        if (!scoredMap.has(r.id)) {
          const score = (1 - r.distance / (maxDistance || 1)) * semanticWeight;
          scoredMap.set(r.id, {
            snippet: {
              id: r.id,
              category: r.category,
              name: r.name,
              content: r.content,
              embedding: null,
              teamId: null,
              createdAt: new Date(),
            },
            score,
          });
        }
      }

      // Sort by score descending
      const allScored = Array.from(scoredMap.values())
        .sort((a, b) => b.score - a.score);

      const total = allScored.length;
      const paginated = allScored.slice(offset, offset + limit).map((s) => s.snippet);

      return {
        snippets: paginated,
        total,
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
