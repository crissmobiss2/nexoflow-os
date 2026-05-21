import fs from "fs/promises";
import path from "path";
import { db } from "@/server/db";
import { knowledgeSnippets } from "@/server/db/schema";
import { sql, eq, inArray } from "drizzle-orm";

// Bundled knowledge files (always available, used as fallback)
const BUNDLED: Record<string, string> = {
  "mobile-playbook":     "mobile-playbook.md",
  "desktop-playbook":    "desktop-playbook.md",
  "mobile-standards":    "mobile-standards.md",
  "desktop-standards":   "desktop-standards.md",
  "app-design-system":   "app-design-system.md",
  "architecture-patterns": "architecture-patterns.md",
  "opportunity-scoring": "opportunity-scoring.md",
  "revenue-patterns":    "revenue-patterns.md",
  "pricing-intelligence":"pricing-intelligence.md",
  "product-discovery":   "product-discovery.md",
  "scope-template":      "scope-template.md",
  "ai-system-design":    "ai-system-design.md",
};

// Maps project type / context category to second brain categories
const CONTEXT_CATEGORIES: Record<string, string[]> = {
  playbooks:   ["Architecture", "Software Design Patterns", "System Design", "API Design"],
  standards:   ["Clean Code", "Code Quality", "Testing", "Security", "SOLID Principles", "Error Handling"],
  commercial:  ["Career Growth", "Agile Practices", "Project Management"],
  product:     ["Architecture", "System Design & Architecture", "Database Design"],
  tech:        ["Frontend", "Backend", "Mobile", "DevOps", "Database", "Cloud", "AI"],
  // Project-type-specific
  website:     ["Frontend", "Frontend Performance", "SEO Advanced", "CSS Modern", "Next.js Deep"],
  web_app:     ["Architecture", "Backend", "Frontend", "Database", "Authentication", "Authorization"],
  mobile_app:  ["Mobile", "Mobile Development", "Mobile Performance", "React Native Complete"],
  desktop_app: ["Architecture", "Backend", "Database"],
  saas:        ["Architecture", "Authentication", "Authorization", "Database", "Cloud", "Microservices"],
  marketplace: ["Architecture", "Database Design", "Security", "Performance"],
  internal_tool:["Backend", "Database", "Authentication", "API Design"],
  ai_product:  ["AI", "AI Engineering", "Architecture", "Database", "Performance"],
  ecommerce:   ["Backend", "Database", "Security", "Performance", "Industry:E-Commerce"],
  portal:      ["Authentication", "Authorization", "Backend", "Frontend"],
  scoring:     ["Architecture", "System Design", "Engineering Ethics", "Career Growth"],
};

async function readFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.replace(/^---[\s\S]*?---\n/, "").trim();
  } catch {
    return null;
  }
}

async function loadBundled(): Promise<string> {
  const bundledDir = path.join(process.cwd(), "src", "knowledge");
  const sections: string[] = [];
  for (const [name, file] of Object.entries(BUNDLED)) {
    const content = await readFile(path.join(bundledDir, file));
    if (content) sections.push(`### ${name.replace(/-/g, " ")}\n\n${content}`);
  }
  return sections.join("\n\n---\n\n");
}

async function loadSnippetsFromDB(categories: string[], limit = 40): Promise<string> {
  try {
    const snippets = await db
      .select({
        category: knowledgeSnippets.category,
        name: knowledgeSnippets.name,
        content: knowledgeSnippets.content,
      })
      .from(knowledgeSnippets)
      .where(inArray(knowledgeSnippets.category, categories))
      .orderBy(sql`random()`)
      .limit(limit);

    if (snippets.length === 0) return "";

    return `## NexoFlow Knowledge Base (${snippets.length} snippets)\n\n` +
      snippets.map((s) => `### [${s.category}] ${s.name}\n\n${s.content}`).join("\n\n---\n\n");
  } catch {
    return "";
  }
}

async function loadFromVault(vaultPath: string, categories: string[]): Promise<string> {
  const VAULT_MAP: Record<string, string[]> = {
    playbooks: [
      "NexoFlow System/Playbooks/Mobile App Build Playbook.md",
      "NexoFlow System/Playbooks/Desktop App Build Playbook.md",
      "NexoFlow System/Playbooks/SaaS Build Playbook.md",
      "NexoFlow System/Playbooks/Website Build Playbook.md",
    ],
    standards: [
      "NexoFlow System/Knowledge and Tech/Mobile Engineering Standards.md",
      "NexoFlow System/Knowledge and Tech/Desktop Engineering Standards.md",
      "NexoFlow System/Knowledge and Tech/App Design System.md",
      "NexoFlow System/Knowledge and Tech/Architecture Patterns.md",
    ],
    commercial: [
      "NexoFlow System/Commercial Intelligence/Opportunity Scoring Framework.md",
      "NexoFlow System/Commercial Intelligence/Revenue Architecture Patterns.md",
      "NexoFlow System/Pricing Intelligence.md",
    ],
    product: [
      "NexoFlow System/Product Strategy/Product Discovery Playbook.md",
      "NexoFlow System/Product Strategy/Build Scope Template.md",
      "NexoFlow System/Product Strategy/Client Software Strategy Template.md",
    ],
    tech: [
      "NexoFlow System/Knowledge and Tech/AI System Design Guide.md",
      "NexoFlow System/Knowledge and Tech/Stack Deep Dives Index.md",
    ],
  };

  const sections: string[] = [];
  for (const cat of categories) {
    const files = VAULT_MAP[cat];
    if (!files) continue;
    for (const file of files) {
      const content = await readFile(path.join(vaultPath, file));
      if (content) sections.push(`### ${path.basename(file, ".md")}\n\n${content}`);
    }
  }
  return sections.join("\n\n---\n\n");
}

export type ContextCategory = keyof typeof CONTEXT_CATEGORIES | string;

export async function loadBrainContext(
  categories: ContextCategory[] = ["playbooks", "standards", "commercial", "product", "tech"],
): Promise<string> {
  const vaultPath = process.env.SECOND_BRAIN_PATH;
  const parts: string[] = [];

  // 1. Try vault (local dev — richest context)
  if (vaultPath) {
    try {
      await fs.access(vaultPath);
      const vaultContent = await loadFromVault(vaultPath, categories);
      if (vaultContent) parts.push(vaultContent);
    } catch {
      // Not accessible
    }
  }

  // 2. Pull relevant snippets from DB (works in production too)
  const dbCategories = categories.flatMap((cat) => CONTEXT_CATEGORIES[cat] ?? [cat]);
  const uniqueCategories = [...new Set(dbCategories)];
  if (uniqueCategories.length > 0) {
    const snippetContext = await loadSnippetsFromDB(uniqueCategories, 30);
    if (snippetContext) parts.push(snippetContext);
  }

  // 3. Fallback to bundled if nothing else worked
  if (parts.length === 0) {
    const bundled = await loadBundled();
    if (bundled) parts.push(bundled);
  }

  return parts.join("\n\n===\n\n");
}
