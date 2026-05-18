/**
 * Seeds the nf_knowledge_snippets table from the Second Brain snippets.json.
 * Run with: npx tsx scripts/seed-knowledge.ts
 * Requires DATABASE_URL and SECOND_BRAIN_PATH env vars.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { knowledgeSnippets } from "../src/server/db/schema";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
const SECOND_BRAIN_PATH = process.env.SECOND_BRAIN_PATH;

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!SECOND_BRAIN_PATH) throw new Error("SECOND_BRAIN_PATH is required");

const snippetsPath = path.join(SECOND_BRAIN_PATH, "snippets.json");
if (!fs.existsSync(snippetsPath)) {
  throw new Error(`snippets.json not found at ${snippetsPath}`);
}

type RawSnippet = { cat: string; name: string; content: string };

async function seed() {
  const client = postgres(DATABASE_URL!, { max: 5 });
  const db = drizzle(client);

  console.log("Reading snippets.json...");
  const raw = fs.readFileSync(snippetsPath, "utf-8");
  const snippets: RawSnippet[] = JSON.parse(raw) as RawSnippet[];
  console.log(`Loaded ${snippets.length.toLocaleString()} snippets across categories.`);

  // Clear existing
  console.log("Clearing existing snippets...");
  await db.delete(knowledgeSnippets);

  // Batch insert — 500 at a time to stay within query size limits
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < snippets.length; i += BATCH) {
    const batch = snippets.slice(i, i + BATCH).map((s) => ({
      category: s.cat.trim(),
      name: s.name.trim(),
      content: s.content.trim(),
    }));

    await db.insert(knowledgeSnippets).values(batch);
    inserted += batch.length;

    const pct = ((inserted / snippets.length) * 100).toFixed(1);
    process.stdout.write(`\r  Inserted ${inserted.toLocaleString()} / ${snippets.length.toLocaleString()} (${pct}%)`);
  }

  console.log("\nDone. Knowledge base seeded.");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
