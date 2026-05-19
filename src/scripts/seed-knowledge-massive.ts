/**
 * seed-knowledge-massive.ts — 20x knowledge seed script
 *
 * Walks /opt/data/second-brain/ recursively, parses ALL .md files,
 * extracts YAML frontmatter (tags, category, created), first heading as name,
 * and batch-inserts into nf_knowledge_snippets via Drizzle ORM.
 *
 * Deduplicates by (category, name). Prints stats per category.
 * Supports --dry-run flag to preview without inserting.
 *
 * Usage:
 *   npx tsx src/scripts/seed-knowledge-massive.ts
 *   npx tsx src/scripts/seed-knowledge-massive.ts --dry-run
 *
 * Requires DATABASE_URL env var (loaded by dotenv or from .env).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { knowledgeSnippets } from "../server/db/schema";
import fs from "fs";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const SECOND_BRAIN_PATH = "/opt/data/second-brain";
const BATCH_SIZE = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDryRun(): boolean {
  return process.argv.includes("--dry-run");
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns { frontmatter: Record<string, unknown>, body: string }
 * where body is everything after the closing `---`.
 */
function parseFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatter: Record<string, unknown> = {};
  let body = content;

  const trimmed = content.trimStart();
  if (trimmed.startsWith("---")) {
    const endIndex = trimmed.indexOf("---", 3);
    if (endIndex !== -1) {
      const yamlBlock = trimmed.slice(3, endIndex).trim();
      body = trimmed.slice(endIndex + 3).trimStart();

      // Parse simple key-value YAML (no nested structures needed)
      for (const line of yamlBlock.split("\n")) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) continue;

        const colonIdx = trimmedLine.indexOf(":");
        if (colonIdx === -1) continue;

        const key = trimmedLine.slice(0, colonIdx).trim().toLowerCase();
        let value: unknown = trimmedLine.slice(colonIdx + 1).trim();

        // Handle quoted strings
        if (
          typeof value === "string" &&
          value.startsWith('"') &&
          value.endsWith('"')
        ) {
          value = value.slice(1, -1);
        } else if (
          typeof value === "string" &&
          value.startsWith("'") &&
          value.endsWith("'")
        ) {
          value = value.slice(1, -1);
        }

        // Handle array syntax: [item1, item2, ...]
        if (
          typeof value === "string" &&
          value.startsWith("[") &&
          value.endsWith("]")
        ) {
          const inner = value.slice(1, -1);
          value = inner
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter((s) => s.length > 0);
        }

        // Handle multiline list syntax (- item)
        // This is handled by checking if value is empty and the next logical lines start with "-"

        frontmatter[key] = value;
      }

      // Re-parse for multiline list values (lines starting with "- ")
      const lines = yamlBlock.split("\n");
      let currentKey: string | null = null;
      const listItems: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const colonIdx = line.indexOf(":");
        if (colonIdx !== -1) {
          // Flush previous multiline list if any
          if (currentKey && listItems.length > 0) {
            frontmatter[currentKey] = [...listItems];
          }
          listItems.length = 0;

          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const val = line.slice(colonIdx + 1).trim();
          currentKey = key;

          if (val.length > 0 && !val.startsWith("-")) {
            // Already handled above for scalar values
            currentKey = null;
          } else if (val.startsWith("-")) {
            listItems.push(val.slice(1).trim().replace(/^["']|["']$/g, ""));
            currentKey = key;
          }
        } else if (currentKey && line.startsWith("- ")) {
          listItems.push(line.slice(2).trim().replace(/^["']|["']$/g, ""));
        }
      }

      // Flush last multiline list
      if (currentKey && listItems.length > 0) {
        frontmatter[currentKey] = [...listItems];
      }
    }
  }

  return { frontmatter, body };
}

/**
 * Extract the first H1 heading (# title) from body content.
 */
function extractFirstHeading(body: string): string | null {
  // Must be at start of line: "# " or "#Title"
  const match = body.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Get parent directory name from file path (used as category fallback).
 */
function parentDirName(filePath: string): string {
  return path.basename(path.dirname(filePath));
}

/**
 * Get all .md files recursively, skipping .git directory and binary files.
 */
function getAllMarkdownFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries: fs.DirEnt[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // permission denied, skip
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip .git directory
      if (entry.name === ".git" || entry.name === "node_modules") continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".md")
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}

/**
 * Check if a file is likely binary (not readable text).
 */
function isBinaryFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    // Check for null bytes — strong indicator of binary content
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Parse a markdown file into a knowledge snippet record.
 * Returns null if the file is invalid or cannot be parsed.
 */
function parseMarkdownFile(
  filePath: string,
): {
  category: string;
  name: string;
  content: string;
  created: string | null;
} | null {
  try {
    if (isBinaryFile(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) return null;

    const { frontmatter, body } = parseFrontmatter(content);

    // --- Determine category ---
    let category: string | null = null;

    // 1. Explicit "category" field in frontmatter
    if (frontmatter.category && typeof frontmatter.category === "string") {
      category = frontmatter.category.trim();
    }

    // 2. Tags field as category (join array)
    if (!category && frontmatter.tags) {
      if (Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0) {
        // Use the first tag as primary category, or join all
        const tags = frontmatter.tags as string[];
        // If there's a single meaningful tag, use it
        category = tags.join(", ");
      } else if (typeof frontmatter.tags === "string") {
        const tagStr = frontmatter.tags.trim();
        if (tagStr && !tagStr.startsWith("[")) {
          category = tagStr;
        }
      }
    }

    // 3. Fall back to parent directory name
    if (!category) {
      const dir = parentDirName(filePath);
      // Clean up numbered prefixes like "1 - Projects" -> "Projects"
      category = dir.replace(/^\d+\s*-\s*/, "").trim();
    }

    if (!category) {
      category = "Uncategorized";
    }

    // --- Determine name ---
    let name: string | null = null;

    // 1. Explicit "title" field in frontmatter
    if (frontmatter.title && typeof frontmatter.title === "string") {
      name = frontmatter.title.trim();
    }

    // 2. First H1 heading
    if (!name) {
      name = extractFirstHeading(body);
    }

    // 3. First H2 heading if no H1
    if (!name) {
      const match = body.match(/^##\s+(.+)$/m);
      if (match && match[1]) {
        name = match[1].trim();
      }
    }

    // 4. Filename without extension
    if (!name) {
      name = path.basename(filePath, ".md").trim();
    }

    // --- Sanitize content ---
    const snippetContent = body.trim();
    if (!snippetContent) return null;

    // --- Extract created date ---
    let created: string | null = null;
    if (frontmatter.created && typeof frontmatter.created === "string") {
      created = frontmatter.created.trim();
    } else if (frontmatter.date && typeof frontmatter.date === "string") {
      created = frontmatter.date.trim();
    }

    return {
      category,
      name,
      content: snippetContent,
      created,
    };
  } catch {
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = isDryRun();
  const startTime = Date.now();

  console.log(`🔍 Scanning ${SECOND_BRAIN_PATH} for .md files...`);
  const allFiles = getAllMarkdownFiles(SECOND_BRAIN_PATH);
  console.log(`   Found ${allFiles.length} .md files.`);

  // Parse all files
  console.log(`\n📄 Parsing markdown files...`);
  const snippets: Array<{
    category: string;
    name: string;
    content: string;
    created: string | null;
  }> = [];

  let parseErrors = 0;
  for (const filePath of allFiles) {
    const result = parseMarkdownFile(filePath);
    if (result) {
      snippets.push(result);
    } else {
      parseErrors++;
    }
  }

  console.log(`   Parsed ${snippets.length} valid snippets.`);
  if (parseErrors > 0) {
    console.log(`   ${parseErrors} files skipped (binary, empty, or unparseable).`);
  }

  // Per-category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const s of snippets) {
    categoryCounts[s.category] = (categoryCounts[s.category] ?? 0) + 1;
  }

  console.log(`\n📊 Per-category breakdown:`);
  const sortedCategories = Object.entries(categoryCounts).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [cat, count] of sortedCategories) {
    console.log(`   ${cat}: ${count}`);
  }

  // Dry-run: just print what would happen
  if (dryRun) {
    console.log(`\n🏁 DRY RUN — no changes made.`);
    console.log(
      `   Would insert ${snippets.length} snippets across ${sortedCategories.length} categories.`,
    );
    process.exit(0);
  }

  // ─── Database: connect, deduplicate, batch insert ─────────────────────────

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required.");
  }

  console.log(`\n🗄️  Connecting to database...`);
  const client = postgres(DATABASE_URL, { max: 5 });
  const db = drizzle(client);

  // Fetch existing (category, name) pairs to deduplicate
  console.log(`   Querying existing snippets for deduplication...`);
  const existing = await db
    .select({ category: knowledgeSnippets.category, name: knowledgeSnippets.name })
    .from(knowledgeSnippets);

  const existingSet = new Set<string>();
  for (const row of existing) {
    existingSet.add(`${row.category}|${row.name}`);
  }

  // Filter out duplicates
  const newSnippets = snippets.filter((s) => {
    const key = `${s.category}|${s.name}`;
    return !existingSet.has(key);
  });

  const skippedCount = snippets.length - newSnippets.length;
  console.log(
    `   ${newSnippets.length} to insert, ${skippedCount} skipped (already exist).`,
  );

  if (newSnippets.length === 0) {
    console.log(`\n✅ Nothing to insert. All snippets already in database.`);
    await client.end();
    process.exit(0);
  }

  // Batch insert
  console.log(`\n📦 Inserting in batches of ${BATCH_SIZE}...`);
  let inserted = 0;

  for (let i = 0; i < newSnippets.length; i += BATCH_SIZE) {
    const batch = newSnippets.slice(i, i + BATCH_SIZE).map((s) => ({
      category: s.category,
      name: s.name,
      content: s.content,
    }));

    await db.insert(knowledgeSnippets).values(batch);
    inserted += batch.length;

    const pct = ((inserted / newSnippets.length) * 100).toFixed(1);
    process.stdout.write(
      `\r   Inserted ${inserted.toLocaleString()} / ${newSnippets.length.toLocaleString()} (${pct}%)`,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n✅ Seeding complete!`);
  console.log(`   Total files found:   ${allFiles.length}`);
  console.log(`   Total parsed:        ${snippets.length}`);
  console.log(`   Total inserted:      ${inserted}`);
  console.log(`   Total skipped (dup): ${skippedCount}`);
  console.log(`   Total categories:    ${sortedCategories.length}`);
  console.log(`   Time:                ${elapsed}s`);

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
