/**
 * embed-existing-snippets.ts — Generate embeddings for all knowledge snippets
 * that don't have one yet.
 *
 * Queries all snippets where embedding IS NULL, generates embeddings via
 * Anthropic/Claude in batches of 20, and updates the database.
 *
 * Usage:
 *   npx tsx src/scripts/embed-existing-snippets.ts
 *   npx tsx src/scripts/embed-existing-snippets.ts --batch-size 10
 *
 * Requires DATABASE_URL and ANTHROPIC_API_KEY env vars.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql, isNull } from "drizzle-orm";
import { knowledgeSnippets } from "../server/db/schema";
import fs from "fs";
import path from "path";

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnvFile(): void {
  const possible = [
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../../.env"),
  ];
  for (const envPath of possible) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
      break;
    }
  }
}
loadEnvFile();

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = parseInt(process.argv.find((a) => a.startsWith("--batch-size="))?.split("=")[1] ?? "20", 10);

// ─── DB connection ────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient);

// ─── Embedding function ───────────────────────────────────────────────────────

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.anthropic.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { embedding: number[] };
  return data.embedding;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.anthropic.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { embeddings: { embedding: number[] }[] };
  return data.embeddings.map((e) => e.embedding);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Querying snippets without embeddings...");

  // Get total count of un-embedded snippets
  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(knowledgeSnippets)
    .where(isNull(knowledgeSnippets.embedding));

  const totalUnembedded = countResult?.total ?? 0;
  console.log(`📊 Found ${totalUnembedded} snippets without embeddings`);

  if (totalUnembedded === 0) {
    console.log("✅ All snippets already have embeddings!");
    process.exit(0);
  }

  let processed = 0;
  let offset = 0;
  let errors = 0;

  while (processed < totalUnembedded) {
    // Fetch a batch
    const batch = await db
      .select({
        id: knowledgeSnippets.id,
        name: knowledgeSnippets.name,
        content: knowledgeSnippets.content,
        category: knowledgeSnippets.category,
      })
      .from(knowledgeSnippets)
      .where(isNull(knowledgeSnippets.embedding))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (batch.length === 0) break;

    const batchNum = Math.floor(processed / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalUnembedded / BATCH_SIZE);
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} snippets)`);

    try {
      // Generate embeddings
      const textsToEmbed = batch.map((s) => `${s.name}\n\n${s.content.slice(0, 8000)}`);
      const embeddings = await getEmbeddings(textsToEmbed);

      // Update each snippet
      for (let i = 0; i < batch.length; i++) {
        const snippet = batch[i]!;
        const embedding = embeddings[i]!;

        await db
          .update(knowledgeSnippets)
          .set({ embedding: sql`${embedding}::vector` })
          .where(eq(knowledgeSnippets.id, snippet.id));

        processed++;
      }

      const pct = Math.round((processed / totalUnembedded) * 100);
      console.log(`✅ Batch ${batchNum} done — ${processed}/${totalUnembedded} (${pct}%)`);

      offset += batch.length;
    } catch (err) {
      errors++;
      console.error(`❌ Batch ${batchNum} failed:`, err instanceof Error ? err.message : err);

      // If too many consecutive errors, bail
      if (errors >= 3) {
        console.error("❌ Too many consecutive errors, aborting");
        break;
      }

      // Wait before retrying
      console.log("⏳ Waiting 5 seconds before retry...");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.log(`\n🎉 Done! Processed ${processed}/${totalUnembedded} snippets`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} batches had errors`);
  }

  await queryClient.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
