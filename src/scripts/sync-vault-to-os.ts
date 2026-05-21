#!/usr/bin/env tsx
/**
 * Sync Vault to OS Script
 *
 * Walks the second brain vault, compares with last sync state,
 * upserts new/changed files into nf_knowledge_snippets, deletes removed files.
 *
 * Usage:
 *   npm run sync:vault                          # One-shot sync (changed files only)
 *   npm run sync:vault -- --full                # Full re-sync (all files)
 *   npm run sync:vault:watch                    # Watch mode (re-syncs on file changes)
 *   npm run sync:vault:watch -- --vault /path   # Custom vault path
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, eq, desc } from "drizzle-orm";
import * as schema from "../server/db/schema";
import { getEmbedding } from "../lib/ai/embeddings";

// ─── Config ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const NEXOFLOW_ROOT = path.resolve(SCRIPT_DIR, "../../");

// Sync state lives outside the vault so it never gets committed to the brain
const SYNC_STATE_FILE = path.join(NEXOFLOW_ROOT, "tmp", "sync-state.json");
const BATCH_SIZE = 10;

function getVaultPath(): string {
  // Check CLI --vault flag first
  const args = process.argv.slice(2);
  const vaultIdx = args.indexOf("--vault");
  if (vaultIdx !== -1 && args[vaultIdx + 1]) return args[vaultIdx + 1]!;

  // Then env var
  const envPath = process.env.SECOND_BRAIN_PATH;
  if (envPath) return envPath;

  // Fallback: detect from script location (sister directory on this machine)
  const siblingVault = path.resolve(NEXOFLOW_ROOT, "../second-brain");
  if (fsSync.existsSync(siblingVault)) return siblingVault;

  return "/opt/data/second-brain";
}

const VAULT_PATH = getVaultPath();

// ─── DB Connection ────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[sync] ERROR: DATABASE_URL is not set. Run with .env.local loaded.");
  console.error("[sync]   Use: npm run sync:vault  (which adds --env-file .env.local)");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 5 });
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
  await fs.mkdir(path.dirname(SYNC_STATE_FILE), { recursive: true });
  await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function walkVault(baseDir: string): Promise<Map<string, { mtime: number; size: number }>> {
  const files = new Map<string, { mtime: number; size: number }>();

  async function walk(currentDir: string) {
    let entries: fsSync.Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === ".obsidian" ||
          entry.name === "scripts"
        ) continue;
        await walk(fullPath);
      } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
        try {
          const stat = await fs.stat(fullPath);
          // Use forward-slash relative paths for cross-platform consistency
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
          files.set(relativePath, { mtime: stat.mtimeMs, size: stat.size });
        } catch {
          // Skip files we can't stat
        }
      }
    }
  }

  await walk(baseDir);
  return files;
}

function deriveCategory(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  // Use the immediate parent folder as category; fall back to top-level folder
  if (parts.length === 1) return "Uncategorized";
  if (parts.length === 2) return parts[0] ?? "Uncategorized";
  return parts[parts.length - 2] ?? "Uncategorized";
}

function deriveName(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = parts[parts.length - 1]?.replace(/\.md$/i, "") ?? filePath;
  return fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Sync a single file ───────────────────────────────────────────────────────

async function syncFile(relativePath: string, action: "upsert" | "delete", content?: string): Promise<void> {
  const category = deriveCategory(relativePath);
  const name = deriveName(relativePath);

  if (action === "delete") {
    await db
      .delete(schema.knowledgeSnippets)
      .where(
        sql`${schema.knowledgeSnippets.name} = ${name} AND ${schema.knowledgeSnippets.category} = ${category}`,
      );
    return;
  }

  if (!content) return;

  // Strip YAML frontmatter
  const cleanContent = content.replace(/^---[\s\S]*?---\n/, "").trim();
  if (!cleanContent) return;

  // Generate embedding (best-effort — continues if API key is missing/invalid)
  let embedding: number[] | null = null;
  try {
    embedding = await getEmbedding(`${name}\n\n${cleanContent}`.slice(0, 8000));
  } catch {
    // Silently skip — content still syncs without semantic search
  }

  // Upsert by name + category
  const [existing] = await db
    .select({ id: schema.knowledgeSnippets.id })
    .from(schema.knowledgeSnippets)
    .where(
      sql`${schema.knowledgeSnippets.name} = ${name} AND ${schema.knowledgeSnippets.category} = ${category}`,
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.knowledgeSnippets)
      .set({ content: cleanContent, embedding: embedding as any })
      .where(eq(schema.knowledgeSnippets.id, existing.id));
  } else {
    await db.insert(schema.knowledgeSnippets).values({
      category,
      name,
      content: cleanContent,
      embedding: embedding as any,
    });
  }
}

// ─── Update sync metadata table ───────────────────────────────────────────────

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

// ─── Main sync run ────────────────────────────────────────────────────────────

async function runSync(fullResync = false): Promise<void> {
  console.log(`[sync] ${fullResync ? "Full re-sync" : "Incremental sync"} starting…`);
  await updateSyncMeta("syncing");

  try {
    const prevState = fullResync ? null : await loadSyncState();
    const currentFiles = await walkVault(VAULT_PATH);
    const prevFiles = prevState?.files ?? {};
    const now = new Date().toISOString();

    const toUpsert: string[] = [];
    const toDelete: string[] = [];

    for (const [relativePath, stat] of currentFiles) {
      const prev = prevFiles[relativePath];
      if (!prev || stat.mtime > prev.mtime || stat.size !== prev.size) {
        toUpsert.push(relativePath);
      }
    }

    for (const relativePath of Object.keys(prevFiles)) {
      if (!currentFiles.has(relativePath)) toDelete.push(relativePath);
    }

    const totalChanges = toUpsert.length + toDelete.length;
    if (totalChanges === 0) {
      console.log(`[sync] No changes detected — vault is in sync (${currentFiles.size} files).`);
      await updateSyncMeta("idle", currentFiles.size);
      await saveSyncState({ files: Object.fromEntries(currentFiles), updatedAt: now });
      return;
    }

    console.log(`[sync] ${toUpsert.length} to upsert, ${toDelete.length} to delete`);

    // Delete removed files
    for (const relativePath of toDelete) {
      await syncFile(relativePath, "delete");
      console.log(`[sync] Deleted: ${relativePath}`);
    }

    // Upsert new/changed files in batches
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toUpsert.length / BATCH_SIZE);
      process.stdout.write(`[sync] Batch ${batchNum}/${totalBatches}…\r`);

      await Promise.all(
        batch.map(async (relativePath) => {
          try {
            const fullPath = path.join(VAULT_PATH, relativePath);
            const content = await fs.readFile(fullPath, "utf-8");
            await syncFile(relativePath, "upsert", content);
          } catch (err) {
            console.error(`[sync] Failed: ${relativePath}`, err instanceof Error ? err.message : err);
          }
        }),
      );
    }

    process.stdout.write("\n");
    await saveSyncState({ files: Object.fromEntries(currentFiles), updatedAt: now });
    await updateSyncMeta("idle", currentFiles.size);

    console.log(`[sync] Done — ${totalChanges} changes processed. Total: ${currentFiles.size} files.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync] Sync failed: ${msg}`);
    await updateSyncMeta("error", undefined, msg);
    throw err;
  }
}

// ─── Watch Mode ───────────────────────────────────────────────────────────────

function startWatch(): void {
  console.log(`[sync] Watching: ${VAULT_PATH}`);
  console.log("[sync] Press Ctrl+C to stop.\n");

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let syncRunning = false;

  const watcher = fsSync.watch(VAULT_PATH, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const normalizedName = filename.replace(/\\/g, "/");
    if (!normalizedName.endsWith(".md")) return;
    if (normalizedName.startsWith(".") || normalizedName.includes("/.") || normalizedName.includes("node_modules")) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (syncRunning) return;
      console.log(`[sync] Change: ${normalizedName} (${eventType})`);
      syncRunning = true;
      void runSync().finally(() => { syncRunning = false; });
    }, 1500);
  });

  process.on("SIGINT", () => {
    watcher.close();
    console.log("\n[sync] Stopped.");
    void client.end().then(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    watcher.close();
    void client.end().then(() => process.exit(0));
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const watchMode = args.includes("--watch");
  const fullResync = args.includes("--full");

  // Verify vault exists
  try {
    await fs.access(VAULT_PATH);
  } catch {
    console.error(`[sync] Vault path not found: ${VAULT_PATH}`);
    console.error(`[sync] Set SECOND_BRAIN_PATH in .env.local or pass --vault /path/to/vault`);
    process.exit(1);
  }

  console.log(`[sync] Vault: ${VAULT_PATH}`);

  if (watchMode) {
    await runSync(fullResync);
    startWatch();
  } else {
    await runSync(fullResync);
    await client.end();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[sync] Fatal:", err);
  process.exit(1);
});
