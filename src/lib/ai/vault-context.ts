import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { knowledgeSnippets } from "@/server/db/schema";
import { getEmbedding } from "./embeddings";

/**
 * Get vault context for a query using semantic search with pgvector.
 * Generates an embedding from the query, does vector similarity search,
 * and returns top K results with category names.
 */
export async function getVaultContext(
  query: string,
  limit: number = 10,
): Promise<{ category: string; name: string; content: string; similarity: number }[]> {
  if (!query?.trim()) return [];

  try {
    const embedding = await getEmbedding(query.slice(0, 8000));
    if (!embedding || embedding.length === 0) return [];

    const results = await db
      .select({
        category: knowledgeSnippets.category,
        name: knowledgeSnippets.name,
        content: knowledgeSnippets.content,
        distance: sql<number>`${knowledgeSnippets.embedding} <-> ${embedding}::vector`,
      })
      .from(knowledgeSnippets)
      .where(sql`${knowledgeSnippets.embedding} IS NOT NULL`)
      .orderBy(sql`${knowledgeSnippets.embedding} <-> ${embedding}::vector`)
      .limit(limit);

    // Convert distance to similarity score (1 - normalized distance)
    const maxDistance = results.length > 0
      ? Math.max(...results.map((r) => r.distance))
      : 1;

    return results.map((r) => ({
      category: r.category,
      name: r.name,
      content: r.content,
      similarity: maxDistance > 0 ? 1 - r.distance / maxDistance : 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Get vault context filtered by specific categories.
 * Uses direct category filter for targeted context retrieval.
 */
export async function getVaultContextByCategory(
  category: string,
  limit: number = 10,
): Promise<{ category: string; name: string; content: string }[]> {
  if (!category?.trim()) return [];

  try {
    return db
      .select({
        category: knowledgeSnippets.category,
        name: knowledgeSnippets.name,
        content: knowledgeSnippets.content,
      })
      .from(knowledgeSnippets)
      .where(sql`${knowledgeSnippets.category} = ${category}`)
      .orderBy(sql`random()`)
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Format vault context results as a markdown bullet list for AI prompt injection.
 */
export function formatVaultContext(
  results: { category: string; name: string; content: string }[],
): string {
  if (results.length === 0) return "";

  const lines: string[] = [];
  for (const r of results) {
    const excerpt = r.content
      .replace(/[#*`~>|{}\]\[]+/g, "") // Strip markdown formatting for clean injection
      .replace(/\n{3,}/g, "\n\n")       // Normalize whitespace
      .trim()
      .slice(0, 300);                    // Limit excerpt length

    lines.push(`- **${r.name}** (${r.category}): ${excerpt}`);
  }

  return "## Relevant Knowledge from Your Second Brain\n\n" + lines.join("\n\n");
}
