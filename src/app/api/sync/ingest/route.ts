/**
 * POST /api/sync/ingest
 *
 * Accepts a batch of markdown files from the second brain and upserts them
 * into the knowledge hub. Called by the local sync script when Vercel is the
 * target, or by any external automation (GitHub Actions, webhooks, etc.).
 *
 * Body: { secret: string, files: Array<{ path: string, content: string, deleted?: boolean }> }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { knowledgeSnippets, syncMetadata } from "@/server/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { getEmbedding } from "@/lib/ai/embeddings";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "";

function deriveCategory(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length === 1) return "Uncategorized";
  if (parts.length === 2) return parts[0] ?? "Uncategorized";
  return parts[parts.length - 2] ?? "Uncategorized";
}

function deriveName(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = parts[parts.length - 1]?.replace(/\.md$/i, "") ?? filePath;
  return fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(req: NextRequest) {
  // Auth check — require SYNC_SECRET if configured
  if (SYNC_SECRET) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/, "");
    if (token !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { files?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: "files array is required" }, { status: 400 });
  }

  const results = { upserted: 0, deleted: 0, failed: 0 };

  for (const file of body.files as Array<{ path?: string; content?: string; deleted?: boolean }>) {
    if (!file.path) { results.failed++; continue; }

    const category = deriveCategory(file.path);
    const name = deriveName(file.path);

    try {
      if (file.deleted) {
        await db.delete(knowledgeSnippets).where(
          sql`${knowledgeSnippets.name} = ${name} AND ${knowledgeSnippets.category} = ${category}`,
        );
        results.deleted++;
        continue;
      }

      const rawContent = file.content ?? "";
      const cleanContent = rawContent.replace(/^---[\s\S]*?---\n/, "").trim();
      if (!cleanContent) continue;

      let embedding: number[] | null = null;
      try {
        embedding = await getEmbedding(`${name}\n\n${cleanContent}`.slice(0, 8000));
      } catch { /* skip embedding on failure */ }

      const [existing] = await db
        .select({ id: knowledgeSnippets.id })
        .from(knowledgeSnippets)
        .where(sql`${knowledgeSnippets.name} = ${name} AND ${knowledgeSnippets.category} = ${category}`)
        .limit(1);

      if (existing) {
        await db
          .update(knowledgeSnippets)
          .set({ content: cleanContent, embedding: embedding as any })
          .where(eq(knowledgeSnippets.id, existing.id));
      } else {
        await db.insert(knowledgeSnippets).values({
          category,
          name,
          content: cleanContent,
          embedding: embedding as any,
        });
      }

      results.upserted++;
    } catch (err) {
      console.error(`[sync/ingest] Failed for ${file.path}:`, err);
      results.failed++;
    }
  }

  // Update sync metadata
  try {
    const [meta] = await db.select({ id: syncMetadata.id, filesCount: syncMetadata.filesCount })
      .from(syncMetadata).orderBy(desc(syncMetadata.lastSyncAt)).limit(1);

    const newCount = (meta?.filesCount ?? 0) + results.upserted - results.deleted;
    if (meta) {
      await db.update(syncMetadata)
        .set({ filesCount: Math.max(0, newCount), lastSyncAt: new Date(), status: "idle" })
        .where(eq(syncMetadata.id, meta.id));
    } else {
      await db.insert(syncMetadata).values({ filesCount: results.upserted, status: "idle" });
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ...results, total: body.files.length });
}
