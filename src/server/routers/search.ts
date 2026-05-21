import { ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { clients, projects, knowledgeSnippets } from "../db/schema";
import { getObsidianClient } from "@/lib/obsidian-client";

export const searchRouter = createTRPCRouter({
  /**
   * Full unified search across OS database + Obsidian vault.
   * Supports source filtering: 'os', 'os_only', 'vault', 'vault_only', 'all' (default)
   */
  unifiedSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
        sources: z
          .enum(["os", "os_only", "vault", "vault_only", "all"])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, limit, sources } = input;
      const searchPattern = `%${query}%`;

      // Determine which sources to query
      const queryOS = sources === "all" || sources === "os" || sources === "os_only";
      const queryVault = sources === "all" || sources === "os" || sources === "vault" || sources === "vault_only";

      // ── OS Database Search ──────────────────────────────────────────────
      let osResults: Array<{
        source: "os";
        id: string;
        type: string;
        title: string;
        subtitle: string;
        description: string | null;
        href: string;
        score: number;
      }> = [];

      if (queryOS) {
        const [clientResults, projectResults, snippetResults] = await Promise.all([
          // Search clients
          ctx.db
            .select({
              id: clients.id,
              type: sql<string>`'client'`.as("type"),
              title: clients.name,
              subtitle: clients.company,
              description: clients.industry,
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

        osResults = [
          ...clientResults.map((r) => ({
            source: "os" as const,
            ...r,
            subtitle: r.subtitle ?? "",
            href: `/clients/${r.id}`,
            score: 0.9,
          })),
          ...projectResults.map((r) => ({
            source: "os" as const,
            ...r,
            subtitle: r.subtitle ?? "",
            href: `/projects/${r.id}`,
            score: 0.8,
          })),
          ...snippetResults.map((r) => ({
            source: "os" as const,
            ...r,
            subtitle: r.subtitle ?? "",
            href: `/knowledge?q=${encodeURIComponent(query)}`,
            score: 0.7,
          })),
        ];
      }

      // ── Obsidian Vault Search ───────────────────────────────────────────
      let vaultResults: Array<{
        source: "vault";
        id: string;
        type: string;
        title: string;
        subtitle: string;
        description: string | null;
        href: string;
        score: number;
      }> = [];

      if (queryVault) {
        try {
          const obsidian = getObsidianClient();
          const vaultHits = await obsidian.search(query);
          vaultResults = vaultHits.map((h, i) => ({
            source: "vault" as const,
            id: `vault-${i}`,
            type: "vault_note",
            title: h.title,
            subtitle: "Obsidian Vault",
            description: h.excerpt,
            href: h.link,
            score: h.score ?? 0.5,
          }));
        } catch {
          // Vault unavailable — return empty
          vaultResults = [];
        }
      }

      // ── Merge, Deduplicate, Rank ────────────────────────────────────────
      const allResults = [...osResults, ...vaultResults];

      // Deduplicate by title similarity (case-insensitive exact match)
      const seen = new Set<string>();
      const deduped = allResults.filter((r) => {
        const key = r.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Rank by score (descending)
      deduped.sort((a, b) => b.score - a.score);

      // Take top results
      const topResults = deduped.slice(0, limit);

      // Group by type for the existing grouped display
      const grouped: Record<string, typeof topResults> = {};
      for (const r of topResults) {
        const groupKey = r.source === "vault" ? "vault" : r.type;
        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey]!.push(r);
      }

      // Also keep the OS-only grouping for backward compatibility
      const osGrouped = {
        clients: osResults.filter((r) => r.type === "client").map((r) => ({ ...r, href: r.href })),
        projects: osResults.filter((r) => r.type === "project").map((r) => ({ ...r, href: r.href })),
        snippets: osResults.filter((r) => r.type === "snippet").map((r) => ({ ...r, href: r.href })),
      };

      // Vault availability
      let vaultAvailable = false;
      try {
        const obsidian = getObsidianClient();
        vaultAvailable = await obsidian.checkAvailability();
      } catch {
        vaultAvailable = false;
      }

      return {
        results: topResults,
        grouped: {
          ...osGrouped,
          vault: vaultResults.map((r) => ({ ...r, href: r.href })),
        },
        total: topResults.length,
        vaultAvailable,
        vaultResultsCount: vaultResults.length,
      };
    }),

  /**
   * Check whether the Obsidian vault API is available
   */
  vaultAvailable: publicProcedure.query(async () => {
    try {
      const obsidian = getObsidianClient();
      return await obsidian.checkAvailability();
    } catch {
      return false;
    }
  }),
});
