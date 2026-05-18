import fs from "fs/promises";
import path from "path";
import { env } from "@/env";

// Files from the second brain loaded as AI context
const CONTEXT_FILES: Record<string, string[]> = {
  playbooks: [
    "NexoFlow System/Playbooks/Mobile App Build Playbook.md",
    "NexoFlow System/Playbooks/Desktop App Build Playbook.md",
  ],
  standards: [
    "NexoFlow System/Knowledge and Tech/Mobile Engineering Standards.md",
    "NexoFlow System/Knowledge and Tech/Desktop Engineering Standards.md",
    "NexoFlow System/Knowledge and Tech/App Design System.md",
    "NexoFlow System/Knowledge and Tech/Architecture Patterns.md",
  ],
  commercial: [
    "NexoFlow System/Commercial Intelligence/Opportunity Scoring Framework.md",
    "NexoFlow System/Commercial Intelligence/Niche Evaluation Framework.md",
    "NexoFlow System/Commercial Intelligence/Revenue Architecture Patterns.md",
    "NexoFlow System/Pricing Intelligence.md",
  ],
  product: [
    "NexoFlow System/Product Strategy/Product Discovery Playbook.md",
    "NexoFlow System/Product Strategy/Client Software Strategy Template.md",
    "NexoFlow System/Product Strategy/Build Scope Template.md",
  ],
  tech: [
    "NexoFlow System/Knowledge and Tech/Stack Deep Dives Index.md",
    "NexoFlow System/Knowledge and Tech/AI System Design Guide.md",
  ],
};

type ContextCategory = keyof typeof CONTEXT_FILES;

async function readFile(filePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(env.SECOND_BRAIN_PATH, filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    // Strip YAML frontmatter
    return content.replace(/^---[\s\S]*?---\n/, "").trim();
  } catch {
    return null;
  }
}

export async function loadBrainContext(
  categories: ContextCategory[],
): Promise<string> {
  const sections: string[] = [];

  for (const category of categories) {
    const files = CONTEXT_FILES[category] ?? [];
    const loaded: string[] = [];

    for (const file of files) {
      const content = await readFile(file);
      if (content) {
        const title = path.basename(file, ".md");
        loaded.push(`### ${title}\n\n${content}`);
      }
    }

    if (loaded.length > 0) {
      sections.push(
        `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n${loaded.join("\n\n---\n\n")}`,
      );
    }
  }

  return sections.join("\n\n===\n\n");
}

export async function loadFullContext(): Promise<string> {
  return loadBrainContext(Object.keys(CONTEXT_FILES) as ContextCategory[]);
}
