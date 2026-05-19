import { ilike, or, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { clients, projects, knowledgeSnippets } from "../db/schema";

export const searchRouter = createTRPCRouter({
  unifiedSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, limit } = input;
      const searchPattern = `%${query}%`;

      const [clientResults, projectResults, snippetResults] = await Promise.all([
        // Search clients
        ctx.db
          .select({
            id: clients.id,
            type: sql<string>`'client'`.as("type"),
            title: clients.name,
            subtitle: clients.company,
            description: clients.industry,
            matchField: sql<string>`'name, company, industry'`.as("match_field"),
          })
          .from(clients)
          .where(
            or(
              ilike(clients.name, searchPattern),
              ilike(clients.company, searchPattern),
              ilike(clients.industry, searchPattern),
            ),
          )
          .limit(limit),

        // Search projects
        ctx.db
          .select({
            id: projects.id,
            type: sql<string>`'project'`.as("type"),
            title: projects.name,
            subtitle: projects.projectType,
            description: projects.industry,
            matchField: sql<string>`'name, industry'`.as("match_field"),
          })
          .from(projects)
          .where(
            or(
              ilike(projects.name, searchPattern),
              ilike(projects.industry, searchPattern),
            ),
          )
          .limit(limit),

        // Search knowledge snippets
        ctx.db
          .select({
            id: knowledgeSnippets.id,
            type: sql<string>`'snippet'`.as("type"),
            title: knowledgeSnippets.name,
            subtitle: knowledgeSnippets.category,
            description: sql<string>`substr(${knowledgeSnippets.content}, 1, 200)`.as("description"),
            matchField: sql<string>`'name, content'`.as("match_field"),
          })
          .from(knowledgeSnippets)
          .where(
            or(
              ilike(knowledgeSnippets.name, searchPattern),
              ilike(knowledgeSnippets.content, searchPattern),
            ),
          )
          .limit(limit),
      ]);

      // Build a list grouped by type, ordered by relevance
      const allResults = [
        ...clientResults.map((r) => ({
          ...r,
          href: `/clients/${r.id}`,
        })),
        ...projectResults.map((r) => ({
          ...r,
          href: `/projects/${r.id}`,
        })),
        ...snippetResults.map((r) => ({
          ...r,
          href: `/knowledge?q=${encodeURIComponent(query)}`,
        })),
      ];

      // Group by type
      const grouped = {
        clients: clientResults.map((r) => ({ ...r, href: `/clients/${r.id}` })),
        projects: projectResults.map((r) => ({ ...r, href: `/projects/${r.id}` })),
        snippets: snippetResults.map((r) => ({ ...r, href: `/knowledge?q=${encodeURIComponent(query)}` })),
      };

      return {
        results: allResults,
        grouped,
        total: clientResults.length + projectResults.length + snippetResults.length,
      };
    }),
});
