"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/trpc/client";
import { Search, BookOpen, Copy, Check, ChevronRight, Loader2, Hash, Sparkles, Brain, Type, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";

const CATEGORY_COLORS: Record<string, string> = {
  Architecture:        "hsl(220, 90%, 62%)",
  Security:            "hsl(0, 72%, 58%)",
  Performance:         "hsl(35, 90%, 58%)",
  Frontend:            "hsl(262, 83%, 68%)",
  Backend:             "hsl(142, 68%, 45%)",
  Database:            "hsl(207, 90%, 60%)",
  DevOps:              "hsl(190, 85%, 50%)",
  Testing:             "hsl(315, 70%, 60%)",
  "System Design":     "hsl(25, 85%, 55%)",
  Mobile:              "hsl(170, 68%, 45%)",
  Career:              "hsl(50, 80%, 50%)",
  "Career Growth":     "hsl(50, 80%, 50%)",
  AI:                  "hsl(280, 85%, 65%)",
  Cloud:               "hsl(200, 90%, 55%)",
  General:             "hsl(220, 20%, 55%)",
};

function categoryColor(cat: string): string {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]!;
  // Deterministic color from string hash
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 58%)`;
}

type SnippetItem = { id: string; category: string; name: string; content: string };

function SnippetCard({ snippet, onAskClaude }: {
  snippet: SnippetItem;
  onAskClaude: (snippet: SnippetItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = categoryColor(snippet.category);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(snippet.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-xl border transition-all cursor-pointer group"
      style={{ background: "var(--surface-card)", borderColor: expanded ? color : "var(--surface-border)" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className="w-1 rounded-full shrink-0 mt-1 self-stretch min-h-[1.5rem]"
          style={{ background: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: `${color}18`, color }}
            >
              {snippet.category}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
            {snippet.name}
          </h3>
          {!expanded && (
            <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {snippet.content.replace(/[#`*\n]/g, " ").slice(0, 150)}…
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={copy}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: "var(--surface-elevated)" }}
            title="Copy content"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" style={{ color: "var(--text-muted)" }} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAskClaude(snippet); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: "hsl(262 83% 68% / 0.15)" }}
            title="Ask Claude about this"
          >
            <Sparkles className="w-3 h-3" style={{ color: "hsl(262, 83%, 68%)" }} />
          </button>
          <ChevronRight
            className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-90")}
            style={{ color: "var(--text-muted)" }}
          />
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-4 pt-1"
          style={{ borderTop: "1px solid var(--surface-border)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="prose-nexoflow text-xs rounded-xl p-4 overflow-auto max-h-96"
            style={{ background: "hsl(220, 20%, 8%)" }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(snippet.content) }}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              Copy snippet
            </button>
            <button
              onClick={() => onAskClaude(snippet)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
            >
              <Sparkles className="w-3 h-3" /> Ask Claude about this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [searchMode, setSearchMode] = useState<"text" | "semantic" | "hybrid">("text");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setOffset(0); }, [activeCategory]);

  // Generate embedding server-side via tRPC
  const needsEmbedding = (searchMode === "semantic" || searchMode === "hybrid") && debouncedQuery.trim().length > 0;
  const { data: semanticEmbedding, isLoading: isEmbedding } = api.knowledge.embed.useQuery(
    debouncedQuery,
    { enabled: needsEmbedding },
  );

  const { data: stats } = api.knowledge.stats.useQuery();
  const { data: categoriesData } = api.knowledge.categories.useQuery();

  // Text search
  const textSearch = api.knowledge.search.useQuery({
    query: debouncedQuery,
    category: activeCategory || undefined,
    limit: 30,
    offset,
  }, {
    enabled: searchMode === "text",
  });

  // Semantic search
  const semanticSearch = api.knowledge.semanticSearch.useQuery({
    embedding: semanticEmbedding ?? [],
    category: activeCategory || undefined,
    limit: 30,
    offset,
  }, {
    enabled: searchMode === "semantic" && !!semanticEmbedding && debouncedQuery.trim().length > 0,
  });

  // Hybrid search
  const hybridSearch = api.knowledge.hybridSearch.useQuery({
    query: debouncedQuery,
    embedding: semanticEmbedding ?? [],
    category: activeCategory || undefined,
    limit: 30,
    offset,
  }, {
    enabled: searchMode === "hybrid" && !!semanticEmbedding && debouncedQuery.trim().length > 0,
  });

  // Determine which results to show
  const isLoading = searchMode === "text"
    ? textSearch.isLoading
    : searchMode === "semantic"
      ? semanticSearch.isLoading || isEmbedding
      : hybridSearch.isLoading || isEmbedding;

  const results = searchMode === "text"
    ? textSearch.data
    : searchMode === "semantic"
      ? semanticSearch.data
      : hybridSearch.data;

  const handleAskClaude = useCallback((snippet: { category: string; name: string }) => {
    const params = new URLSearchParams({
      mode: "general",
      prefill: `Tell me more about "${snippet.name}" (${snippet.category}). Give me practical examples and how I'd use this at NexoFlow.`,
    });
    window.open(`/ai?${params.toString()}`, "_blank");
  }, []);

  const categories = categoriesData ?? [];
  const snippets = results?.snippets ?? [];
  const total = results?.total ?? 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Category sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: "1px solid var(--surface-border)", background: "var(--surface-card)" }}
      >
        <div className="p-4 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="flex items-center gap-2 mb-0.5">
            <BookOpen className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
            <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Knowledge Hub</h1>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {stats?.total.toLocaleString() ?? "…"} snippets · {stats?.categories ?? "…"} categories
          </p>
        </div>

        <div className="flex-1 overflow-auto p-2">
          <button
            onClick={() => setActiveCategory("")}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-all",
            )}
            style={
              !activeCategory
                ? { background: "hsl(220 90% 62% / 0.15)", color: "var(--brand-primary)" }
                : { color: "var(--text-secondary)" }
            }
          >
            <span>All Categories</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {stats?.total.toLocaleString()}
            </span>
          </button>

          {categories.map((cat) => {
            const color = categoryColor(cat.category);
            const active = activeCategory === cat.category;
            return (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all"
                style={
                  active
                    ? { background: `${color}18`, color }
                    : { color: "var(--text-secondary)" }
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="truncate">{cat.category}</span>
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  {cat.count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="p-4 shrink-0 space-y-3" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="relative max-w-2xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeCategory ? `Search in ${activeCategory}…` : "Search 67,607 snippets — React, Postgres, Docker, OWASP, CAP theorem…"}
              className="nf-input pl-10 pr-4 w-full"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Search mode toggle */}
          <div className="flex items-center gap-1.5">
            {([
              { mode: "text" as const, icon: Type, label: "Text Search" },
              { mode: "semantic" as const, icon: Brain, label: "Semantic" },
              { mode: "hybrid" as const, icon: Layers, label: "Hybrid" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={
                  searchMode === mode
                    ? { background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }
                    : { background: "var(--surface-elevated)", color: "var(--text-muted)" }
                }
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
            {isEmbedding && (
              <span className="text-[10px] flex items-center gap-1 ml-1" style={{ color: "var(--text-muted)" }}>
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Generating embedding…
              </span>
            )}
          </div>

          {(debouncedQuery || activeCategory) && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isLoading ? "Searching…" : `${(results?.total ?? 0).toLocaleString()} results`}
              {activeCategory && ` in ${activeCategory}`}
              {searchMode !== "text" && " · semantic search"}
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : snippets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Hash className="w-8 h-8 mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {debouncedQuery ? `No snippets found for "${debouncedQuery}"` : "Select a category or search above"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
                {snippets.map((s) => (
                  <SnippetCard key={s.id} snippet={s} onAskClaude={handleAskClaude} />
                ))}
              </div>

              {/* Pagination */}
              {total > 30 && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - 30))}
                    disabled={offset === 0}
                    className="px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-30"
                    style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
                  >
                    ← Previous
                  </button>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {offset + 1}–{Math.min(offset + 30, total)} of {total.toLocaleString()}
                  </span>
                  <button
                    onClick={() => setOffset(offset + 30)}
                    disabled={offset + 30 >= total}
                    className="px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-30"
                    style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
