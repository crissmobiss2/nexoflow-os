#!/usr/bin/env tsx
/**
 * Sync Vault to OS Script
 *
 * Walks the second brain vault, compares with last sync state,
 * upserts new/changed files into nf_knowledge_snippets, deletes removed files.
 *
 * Usage:
 *   tsx src/scripts/sync-vault-to-os.ts                  # One-shot sync
 *   tsx src/scripts/sync-vault-to-os.ts --watch           # Watch mode
 *   tsx src/scripts/sync-vault-to-os.ts --watch --vault /path/to/vault
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, eq, desc, inArray } from "drizzle-orm";
import * as schema from "../server/db/schema";
import { getEmbedding } from "../lib/ai/embeddings";

// ─── Config ───────────────────────────────────────────────────────────────────

const VAULT_PATH = process.env.SECOND_BRAIN_PATH || "/opt/data/second-brain";
const SYNC_STATE_FILE = path.join(VAULT_PATH, ".nexoflow-sync-state.json");
const BATCH_SIZE = 20; // Process in batches to avoid overwhelming the API

// ─── DB Connection ────────────────────────────────────────────────────────────

const client = postgres(process.env.DATABASE_URL!, { max: 5 });
const db = drizzle(client, { schema });

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SyncState {
  files: Record<string, { mtime: number; size: number }>;
  updatedAt: string;
}

async function loadSyncState(): Promise<SyncState | null> {
  try {
    const raw = await fs.readFile(SYNC_STATE_FILE, "utf-8");
    return JSON.parse(raw) as SyncState;
  } catch {
    return null;
  }
}

async function saveSyncState(state: SyncState): Promise<void> {
  await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function walkVault(dir: string, baseDir: string): Promise<Map<string, { mtime: number; size: number }>> {
  const files = new Map<string, { mtime: number; size: number }>();

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories and common non-content dirs
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === ".obsidian") continue;
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const stat = await fs.stat(fullPath);
        const relativePath = path.relative(baseDir, fullPath);
        files.set(relativePath, { mtime: stat.mtimeMs, size: stat.size });
      }
    }
  }

  await walk(baseDir);
  return files;
}

function deriveCategory(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts.length > 1 ? parts[parts.length - 2] ?? "Uncategorized" : "Uncategorized";
}

function deriveName(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = parts[parts.length - 1]?.replace(/\.md$/i, "") ?? filePath;
  return fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

async function syncFile(relativePath: string, _action: "created" | "updated" | "deleted", content?: string): Promise<void> {
  const category = deriveCategory(relativePath);
  const name = deriveName(relativePath);

  if (_action === "deleted") {
    await db
      .delete(schema.knowledgeSnippets)
      .where(
        sql`${schema.knowledgeSnippets.name} = ${name} AND ${schema.knowledgeSnippets.category} = ${category}`,
      );
    return;
  }

  if (!content) return;

  // Strip frontmatter
  const cleanContent = content.replace(/^---[\s\S]*?---\n/, "").trim();
  if (!cleanContent) return;

  // Generate embedding
  const textToEmbed = `${name}\n\n${cleanContent}`;
  let embedding: number[] | null = null;
  try {
    embedding = await getEmbedding(textToEmbed.slice(0, 8000));
  } catch (err) {
    console.error(`[sync] Failed to generate embedding for ${relativePath}:`, err);
  }

  // Upsert
  const existing = await db
    .select({ id: schema.knowledgeSnippets.id })
    .from(schema.knowledgeSnippets)
    .where(
      sql`${schema.knowledgeSnippets.name} = ${name} AND ${schema.knowledgeSnippets.category} = ${category}`,
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.knowledgeSnippets)
      .set({ content: cleanContent, embedding: embedding as any })
      .where(eq(schema.knowledgeSnippets.id, existing[0]!.id));
  } else {
    await db
      .insert(schema.knowledgeSnippets)
      .values({ category, name, content: cleanContent, embedding: embedding as any });
  }
}

async function updateSyncMeta(status: string, filesCount?: number, errorMessage?: string): Promise<void> {
  const [existing] = await db
    .select({ id: schema.syncMetadata.id })
    .from(schema.syncMetadata)
    .orderBy(desc(schema.syncMetadata.lastSyncAt))
    .limit(1);

  const data: Record<string, unknown> = { status, lastSyncAt: new Date() };
  if (filesCount !== undefined) data.filesCount = filesCount;
  if (errorMessage !== undefined) data.errorMessage = errorMessage;

  if (existing) {
    await db.update(schema.syncMetadata).set(data).where(eq(schema.syncMetadata.id, existing.id));
  } else {
    await db.insert(schema.syncMetadata).values(data as any);
  }
}

async function runSync(): Promise<void> {
  console.log("[sync] Starting vault sync...");
  await updateSyncMeta("syncing");

  try {
    const prevState = await loadSyncState();
    const currentFiles = await walkVault(VAULT_PATH, VAULT_PATH);
    const prevFiles = prevState?.files ?? {};
    const now = new Date().toISOString();

    const toCreate: string[] = [];
    const toUpdate: string[] = [];
    const toDelete: string[] = [];

    // Find new/modified files
    for (const [relativePath, stat] of currentFiles) {
      const prev = prevFiles[relativePath];
      if (!prev) {
        toCreate.push(relativePath);
      } else if (stat.mtime > prev.mtime || stat.size !== prev.size) {
        toUpdate.push(relativePath);
      }
    }

    // Find deleted files
    for (const relativePath of Object.keys(prevFiles)) {
      if (!currentFiles.has(relativePath)) {
        toDelete.push(relativePath);
      }
    }

    const totalChanges = toCreate.length + toUpdate.length + toDelete.length;
    if (totalChanges === 0) {
      console.log("[sync] No changes detected. Vault is in sync.");
      await updateSyncMeta("idle", currentFiles.size);
      await saveSyncState({ files: Object.fromEntries(currentFiles), updatedAt: now });
      return;
    }

    console.log(`[sync] Changes detected: ${toCreate.length} new, ${toUpdate.length} modified, ${toDelete.length} deleted`);

    // Process deletions
    for (const relativePath of toDelete) {
      const category = deriveCategory(relativePath);
      const name = deriveName(relativePath);
      await db
        .delete(schema.knowledgeSnippets)
        .where(
          sql`${schema.knowledgeSnippets.name} = ${name} AND ${schema.knowledgeSnippets.category} = ${category}`,
        );
      console.log(`[sync] Deleted: ${relativePath}`);
    }

    // Process new and updated files in batches
    const changedFiles = [...toCreate, ...toUpdate];
    for (let i = 0; i < changedFiles.length; i += BATCH_SIZE) {
      const batch = changedFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (relativePath) => {
          try {
            const fullPath = path.join(VAULT_PATH, relativePath);
            const content = await fs.readFile(fullPath, "utf-8");
            await syncFile(relativePath, "updated", content);
            console.log(`[sync] Synced: ${relativePath}`);
          } catch (err) {
            console.error(`[sync] Failed to sync ${relativePath}:`, err);
          }
        }),
      );
    }

    // Save new sync state
    await saveSyncState({ files: Object.fromEntries(currentFiles), updatedAt: now });
    await updateSyncMeta("idle", currentFiles.size);

    console.log(`[sync] Sync complete. ${totalChanges} files processed. Total: ${currentFiles.size} files.`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sync] Sync failed: ${errorMsg}`);
    await updateSyncMeta("error", undefined, errorMsg);
    process.exit(1);
  }
}

// ─── Watch Mode ───────────────────────────────────────────────────────────────

function startWatch(): void {
  console.log(`[sync] Watching vault: ${VAULT_PATH}`);
  console.log("[sync] Press Ctrl+C to stop");

  let debounceTimer: NodeJS.Timeout | null = null;

  fsSync.watch(VAULT_PATH, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith(".md")) return;
    if (filename.startsWith(".") || filename.includes("node_modules") || filename.includes(".obsidian")) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[sync] File change detected: ${filename} (${eventType})`);
      void runSync();
    }, 2000); // 2-second debounce
  });

  // Keep the process alive
  process.on("SIGINT", () => {
    console.log("\n[sync] Watch mode stopped.");
    process.exit(0);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const watchMode = args.includes("--watch");

  // Allow custom vault path via --vault argument
  const vaultIndex = args.indexOf("--vault");
  if (vaultIndex !== -1 && args[vaultIndex + 1]) {
    process.env.SECOND_BRAIN_PATH = args[vaultIndex + 1]!;
  }

  // Verify vault exists
  try {
    await fs.access(VAULT_PATH);
  } catch {
    console.error(`[sync] Vault path does not exist: ${VAULT_PATH}`);
    process.exit(1);
  }

  console.log(`[sync] Vault path: ${VAULT_PATH}`);

  if (watchMode) {
    // Initial sync, then watch
    await runSync();
    startWatch();
  } else {
    await runSync();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[sync] Fatal error:", err);
  process.exit(1);
});
