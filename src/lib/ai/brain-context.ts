import fs from "fs/promises";
import path from "path";

// Bundled knowledge files (always available, used in production/Vercel)
const BUNDLED: Record<string, string> = {
  "mobile-playbook": "mobile-playbook.md",
  "desktop-playbook": "desktop-playbook.md",
  "mobile-standards": "mobile-standards.md",
  "desktop-standards": "desktop-standards.md",
  "app-design-system": "app-design-system.md",
  "architecture-patterns": "architecture-patterns.md",
  "opportunity-scoring": "opportunity-scoring.md",
  "revenue-patterns": "revenue-patterns.md",
  "pricing-intelligence": "pricing-intelligence.md",
  "product-discovery": "product-discovery.md",
  "scope-template": "scope-template.md",
  "ai-system-design": "ai-system-design.md",
};

// Vault files (local dev only — richer context when second brain is mounted)
const VAULT_FILES: Record<string, string[]> = {
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

type Category = keyof typeof VAULT_FILES;

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
    if (content) {
      sections.push(`### ${name.replace(/-/g, " ")}\n\n${content}`);
    }
  }

  return sections.join("\n\n---\n\n");
}

async function loadFromVault(
  vaultPath: string,
  categories: Category[],
): Promise<string> {
  const sections: string[] = [];

  for (const category of categories) {
    const files = VAULT_FILES[category] ?? [];
    const loaded: string[] = [];

    for (const file of files) {
      const content = await readFile(path.join(vaultPath, file));
      if (content) {
        loaded.push(`### ${path.basename(file, ".md")}\n\n${content}`);
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

export async function loadBrainContext(
  categories: Category[] = ["playbooks", "standards", "commercial", "product", "tech"],
): Promise<string> {
  const vaultPath = process.env.SECOND_BRAIN_PATH;

  if (vaultPath) {
    // Try vault first — richer context in local dev
    try {
      await fs.access(vaultPath);
      return await loadFromVault(vaultPath, categories);
    } catch {
      // Vault not accessible — fall through to bundled
    }
  }

  // Production / Vercel: use bundled knowledge files
  return await loadBundled();
}
