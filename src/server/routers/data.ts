import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  clients,
  projects,
  projectBriefs,
  opportunityScores,
  projectArtifacts,
  projectPhases,
  knowledgeSnippets,
  invoices,
  invoiceLineItems,
  sprintTasks,
  comments,
} from "../db/schema";

export const dataRouter = createTRPCRouter({
  exportAll: publicProcedure.query(async ({ ctx }) => {
    const [allClients, allProjects, allSnippets, allInvoices, allSprintTasks] = await Promise.all([
      ctx.db.query.clients.findMany({ orderBy: [desc(clients.createdAt)] }),
      ctx.db.query.projects.findMany({
        with: {
          brief: true,
          score: true,
          artifacts: true,
          phases: true,
          comments: true,
          client: true,
        },
        orderBy: [desc(projects.createdAt)],
      }),
      ctx.db.query.knowledgeSnippets.findMany({ orderBy: [desc(knowledgeSnippets.createdAt)] }),
      ctx.db.query.invoices.findMany({
        with: { client: true, lineItems: true },
        orderBy: [desc(invoices.createdAt)],
      }),
      ctx.db.query.sprintTasks.findMany({ orderBy: [desc(sprintTasks.createdAt)] }),
    ]);

    return {
      clients: allClients,
      projects: allProjects,
      knowledge: allSnippets,
      invoices: allInvoices,
      sprintTasks: allSprintTasks,
      exportedAt: new Date().toISOString(),
    };
  }),

  import: publicProcedure
    .input(
      z.object({
        data: z.object({
          clients: z.array(z.record(z.unknown())).optional().default([]),
          projects: z.array(z.record(z.unknown())).optional().default([]),
          knowledge: z.array(z.record(z.unknown())).optional().default([]),
          invoices: z.array(z.record(z.unknown())).optional().default([]),
          sprintTasks: z.array(z.record(z.unknown())).optional().default([]),
        }),
        conflictStrategy: z.enum(["skip", "overwrite", "merge"]).default("skip"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results = {
        clients: { imported: 0, skipped: 0, errors: 0 },
        knowledge: { imported: 0, skipped: 0, errors: 0 },
        totalImported: 0,
      };

      // Import clients (no unique constraint issues since id is auto-generated)
      for (const client of input.data.clients) {
        try {
          const existing = client.id
            ? await ctx.db.query.clients.findFirst({ where: eq(clients.id, client.id as string) })
            : null;

          if (existing) {
            if (input.conflictStrategy === "skip") {
              results.clients.skipped++;
              continue;
            }
            if (input.conflictStrategy === "overwrite") {
              await ctx.db.update(clients).set(client).where(eq(clients.id, client.id as string));
              results.clients.imported++;
              continue;
            }
            // merge: skip if exists
            results.clients.skipped++;
            continue;
          }

          const { id, ...safeData } = client;
          await ctx.db.insert(clients).values(safeData as any);
          results.clients.imported++;
        } catch {
          results.clients.errors++;
        }
      }

      // Import knowledge snippets
      for (const snippet of input.data.knowledge) {
        try {
          const existing = snippet.id
            ? await ctx.db.query.knowledgeSnippets.findFirst({
                where: eq(knowledgeSnippets.id, snippet.id as string),
              })
            : null;

          if (existing) {
            if (input.conflictStrategy === "skip") {
              results.knowledge.skipped++;
              continue;
            }
            if (input.conflictStrategy === "overwrite") {
              await ctx.db
                .update(knowledgeSnippets)
                .set(snippet)
                .where(eq(knowledgeSnippets.id, snippet.id as string));
              results.knowledge.imported++;
              continue;
            }
            results.knowledge.skipped++;
            continue;
          }

          const { id, ...safeData } = snippet;
          await ctx.db.insert(knowledgeSnippets).values(safeData as any);
          results.knowledge.imported++;
        } catch {
          results.knowledge.errors++;
        }
      }

      results.totalImported = results.clients.imported + results.knowledge.imported;

      return results;
    }),
});
