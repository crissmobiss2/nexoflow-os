/**
 * Obsidian Local REST API Client
 *
 * Connects to the Obsidian Local REST API plugin when available.
 * Gracefully falls back if the plugin isn't running or configured.
 *
 * API docs: https://github.com/coddingtonbear/obsidian-local-rest-api
 */

const DEFAULT_OBSIDIAN_URL = "http://127.0.0.1:27123";

interface ObsidianVaultFile {
  basename: string;
  content: string;
  extension?: string;
  filename: string;
  frontmatter?: Record<string, unknown>;
  stat?: {
    ctime: number;
    mtime: number;
    size: number;
  };
  tags?: string[];
}

interface ObsidianSearchResult {
  filename: string;
  basename: string;
  content: string;
  score?: number;
  highlights?: string[];
}

interface ObsidianRecentFile {
  filename: string;
  basename: string;
  mtime: number;
}

export interface ObsidianSearchHit {
  source: "vault";
  type: string;
  title: string;
  excerpt: string;
  link: string;
  score: number;
}

class ObsidianClient {
  private baseUrl: string;
  private available: boolean = false;
  private checked: boolean = false;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_OBSIDIAN_URL;
  }

  /**
   * Check if the Obsidian Local REST API plugin is available
   */
  async checkAvailability(): Promise<boolean> {
    if (this.checked) return this.available;
    this.checked = true;
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      this.available = res.ok;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  /**
   * Search the Obsidian vault for notes matching the query
   */
  async search(query: string): Promise<ObsidianSearchHit[]> {
    if (!(await this.checkAvailability())) return [];

    try {
      const res = await fetch(
        `${this.baseUrl}/search?query=${encodeURIComponent(query)}`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) return [];

      const results: ObsidianSearchResult[] = await res.json();

      return results.map((r) => ({
        source: "vault" as const,
        type: "vault_note",
        title: r.basename ?? r.filename ?? "Untitled",
        excerpt: this.makeExcerpt(r.content, query),
        link: `obsidian://open?vault=${encodeURIComponent(r.basename ?? "")}&file=${encodeURIComponent(r.filename ?? "")}`,
        score: r.score ?? 0.5,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get the full content of a specific note
   */
  async getNote(path: string): Promise<ObsidianVaultFile | null> {
    if (!(await this.checkAvailability())) return null;

    try {
      const res = await fetch(
        `${this.baseUrl}/vault/${encodeURIComponent(path)}`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) return null;
      return (await res.json()) as ObsidianVaultFile;
    } catch {
      return null;
    }
  }

  /**
   * Get recently modified notes
   */
  async getRecentNotes(limit: number = 10): Promise<ObsidianSearchHit[]> {
    if (!(await this.checkAvailability())) return [];

    try {
      const res = await fetch(
        `${this.baseUrl}/vault/?limit=${limit}&sort=mtime`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) return [];

      const files: ObsidianRecentFile[] = await res.json();

      return files.map((f) => ({
        source: "vault" as const,
        type: "vault_note",
        title: f.basename ?? f.filename ?? "Untitled",
        excerpt: `Modified ${new Date(f.mtime * 1000).toLocaleDateString()}`,
        link: `obsidian://open?vault=${encodeURIComponent(f.basename ?? "")}&file=${encodeURIComponent(f.filename ?? "")}`,
        score: 0.3,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Extract a relevant excerpt from content around the query match
   */
  private makeExcerpt(content: string, query: string, maxLen: number = 200): string {
    if (!content) return "";
    const lower = content.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return content.slice(0, maxLen).replace(/\n/g, " ").trim();

    const start = Math.max(0, idx - 80);
    const end = Math.min(content.length, idx + query.length + 80);
    let excerpt = content.slice(start, end).replace(/\n/g, " ").trim();

    if (start > 0) excerpt = "…" + excerpt;
    if (end < content.length) excerpt = excerpt + "…";

    return excerpt.slice(0, maxLen);
  }
}

let clientInstance: ObsidianClient | null = null;

/**
 * Get or create the Obsidian client singleton.
 * Respects OBSIDIAN_LOCAL_API_URL env var for the base URL.
 */
export function getObsidianClient(): ObsidianClient {
  if (!clientInstance) {
    const url =
      typeof process !== "undefined"
        ? process.env.OBSIDIAN_LOCAL_API_URL
        : undefined;
    clientInstance = new ObsidianClient(url);
  }
  return clientInstance;
}

export type { ObsidianVaultFile, ObsidianSearchResult, ObsidianSearchHit };
