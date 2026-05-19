import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { knowledgeSnippets, syncMetadata } from "../db/schema";
import { getEmbedding } from "@/lib/ai/embeddings";
import { aiConversations, aiMessages } from "../db/schema";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const vaultToDbInput = z.object({
  filePath: z.string().min(1),
  content: z.string(),
  action: z.enum(["created", "updated", "deleted"]),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const syncRouter = createTRPCRouter({

  // ── vaultToDb ────────────────────────────────────────────────────────────────
  // Webhook endpoint called by the vault when a file changes.
  // Parses markdown, generates embedding, upserts into knowledgeSnippets.

  vaultToDb: publicProcedure
    .input(vaultToDbInput)
    .mutation(async ({ ctx, input }) => {
      const { filePath, content, action } = input;

      // Derive category from the file path (use directory as category)
      const pathParts = filePath.replace(/\\/g, "/").split("/");
      const category = pathParts.length > 1 ? pathParts[pathParts.length - 2] ?? "Uncategorized" : "Uncategorized";
      const name = pathParts[pathParts.length - 1]?.replace(/\.md$/i, "") ?? filePath;
      const sanitizedName = name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      if (action === "deleted") {
        // Remove the snippet if it exists
        await ctx.db
          .delete(knowledgeSnippets)
          .where(
            sql`${knowledgeSnippets.name} = ${sanitizedName} AND ${knowledgeSnippets.category} = ${category}`,
          );

        // Update sync metadata
        const [meta] = await ctx.db
          .select({ filesCount: syncMetadata.filesCount })
          .from(syncMetadata)
          .orderBy(desc(syncMetadata.lastSyncAt))
          .limit(1);

        if (meta) {
          await ctx.db
            .update(syncMetadata)
            .set({
              filesCount: Math.max(0, (meta.filesCount ?? 0) - 1),
              lastSyncAt: new Date(),
            })
            .where(eq(syncMetadata.id, (await ctx.db.select({ id: syncMetadata.id }).from(syncMetadata).limit(1))[0]?.id ?? ""));
        }

        return { success: true, action: "deleted", filePath };
      }

      // Generate embedding for the content
      const textToEmbed = `${sanitizedName}\n\n${content}`;
      let embedding: number[] | null = null;
      try {
        embedding = await getEmbedding(textToEmbed.slice(0, 8000)); // Truncate for API limits
      } catch {
        // Continue without embedding if generation fails
      }

      // Upsert the snippet
      const existing = await ctx.db
        .select({ id: knowledgeSnippets.id })
        .from(knowledgeSnippets)
        .where(
          sql`${knowledgeSnippets.name} = ${sanitizedName} AND ${knowledgeSnippets.category} = ${category}`,
        )
        .limit(1);

      if (existing.length > 0) {
        await ctx.db
          .update(knowledgeSnippets)
          .set({
            content,
            embedding: embedding as any,
          })
          .where(eq(knowledgeSnippets.id, existing[0]!.id));
      } else {
        await ctx.db.insert(knowledgeSnippets).values({
          category,
          name: sanitizedName,
          content,
          embedding: embedding as any,
        });
      }

      // Update sync metadata
      const [meta] = await ctx.db
        .select({ id: syncMetadata.id, filesCount: syncMetadata.filesCount })
        .from(syncMetadata)
        .orderBy(desc(syncMetadata.lastSyncAt))
        .limit(1);

      if (meta) {
        await ctx.db
          .update(syncMetadata)
          .set({
            filesCount: action === "created" ? (meta.filesCount ?? 0) + 1 : meta.filesCount,
            lastSyncAt: new Date(),
            status: "idle",
          })
          .where(eq(syncMetadata.id, meta.id));
      } else {
        await ctx.db.insert(syncMetadata).values({
          filesCount: 1,
          status: "idle",
        });
      }

      return { success: true, action, filePath };
    }),

  // ── dbToVault ────────────────────────────────────────────────────────────────
  // Exports AI conversations and OS data as Obsidian-compatible markdown.

  dbToVault: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(10),
        includeConversations: z.boolean().default(true),
        includeStats: z.boolean().default(false),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const { limit, includeConversations, includeStats } = input;
      const files: { fileName: string; content: string }[] = [];

      // 1. Export recent AI conversations
      if (includeConversations) {
        const conversations = await ctx.db.query.aiConversations.findMany({
          orderBy: [desc(aiConversations.updatedAt)],
          limit,
          with: {
            messages: {
              orderBy: [desc(aiMessages.createdAt)],
              limit: 10,
            },
          },
        });

        for (const convo of conversations) {
          const dateStr = new Date(convo.createdAt).toISOString().split("T")[0];
          const safeTitle = (convo.title ?? `AI Conversation ${convo.id.slice(0, 8)}`)
            .replace(/[^a-zA-Z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");

          let md = "---\n";
          md += `title: "${convo.title ?? "AI Conversation"}"\n`;
          md += `type: ai-conversation\n`;
          md += `mode: ${convo.mode}\n`;
          md += `date: ${dateStr}\n`;
          md += `conversation_id: ${convo.id}\n`;
          md += `message_count: ${convo.messages.length}\n`;
          md += `---\n\n`;
          md += `# ${convo.title ?? "AI Conversation"}\n\n`;
          md += `**Mode:** ${convo.mode}\n`;
          md += `**Date:** ${dateStr}\n\n`;
          md += `---\n\n`;

          const messages = [...convo.messages].reverse();
          for (const msg of messages) {
            const role = msg.role === "user" ? "**You**" : "**NexoFlow AI**";
            md += `### ${role}\n\n${msg.content}\n\n---\n\n`;
          }

          files.push({
            fileName: `AI/${dateStr}-${safeTitle}.md`,
            content: md,
          });
        }
      }

      // 2. Export stats snapshot
      if (includeStats) {
        const [snippetStats] = await ctx.db
          .select({
            total: sql<number>`count(*)::int`,
            categories: sql<number>`count(distinct ${knowledgeSnippets.category})::int`,
          })
          .from(knowledgeSnippets);

        const [meta] = await ctx.db
          .select()
          .from(syncMetadata)
          .orderBy(desc(syncMetadata.lastSyncAt))
          .limit(1);

        let md = "---\n";
        md += `title: "NexoFlow OS Sync Snapshot"\n`;
        md += `type: os-sync-stats\n`;
        md += `date: ${new Date().toISOString().split("T")[0]}\n`;
        md += `---\n\n`;
        md += `# NexoFlow OS Sync Snapshot\n\n`;
        md += `- **Knowledge Snippets:** ${snippetStats?.total ?? 0}\n`;
        md += `- **Categories:** ${snippetStats?.categories ?? 0}\n`;
        md += `- **Last Sync:** ${meta?.lastSyncAt ? new Date(meta.lastSyncAt).toISOString() : "Never"}\n`;
        md += `- **Sync Status:** ${meta?.status ?? "idle"}\n`;

        files.push({
          fileName: `OS Sync/Sync Snapshot.md`,
          content: md,
        });
      }

      return { files };
    }),

  // ── status ───────────────────────────────────────────────────────────────────
  // Returns last sync time, pending changes, sync health.

  status: publicProcedure.query(async ({ ctx }) => {
    const [meta] = await ctx.db
      .select()
      .from(syncMetadata)
      .orderBy(desc(syncMetadata.lastSyncAt))
      .limit(1);

    const [snippetStats] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        categories: sql<number>`count(distinct ${knowledgeSnippets.category})::int`,
      })
      .from(knowledgeSnippets);

    const health: "healthy" | "warning" | "error" =
      !meta ? "warning" :
      meta.status === "error" ? "error" :
      "healthy";

    return {
      lastSyncAt: meta?.lastSyncAt ?? null,
      filesCount: meta?.filesCount ?? 0,
      totalSnippets: snippetStats?.total ?? 0,
      totalCategories: snippetStats?.categories ?? 0,
      status: meta?.status ?? "idle",
      errorMessage: meta?.errorMessage ?? null,
      health,
    };
  }),

  // ── updateSyncStatus ─────────────────────────────────────────────────────────
  // Internal: update sync status (used by the sync script)

  updateSyncStatus: publicProcedure
    .input(
      z.object({
        status: z.enum(["idle", "syncing", "error"]),
        errorMessage: z.string().optional(),
        filesCount: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: syncMetadata.id })
        .from(syncMetadata)
        .orderBy(desc(syncMetadata.lastSyncAt))
        .limit(1);

      const updateData: Record<string, unknown> = {
        status: input.status,
        lastSyncAt: new Date(),
      };
      if (input.errorMessage !== undefined) updateData.errorMessage = input.errorMessage;
      if (input.filesCount !== undefined) updateData.filesCount = input.filesCount;

      if (existing) {
        await ctx.db.update(syncMetadata).set(updateData).where(eq(syncMetadata.id, existing.id));
      } else {
        await ctx.db.insert(syncMetadata).values(updateData as any);
      }

      return { success: true };
    }),
});
