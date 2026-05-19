"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  Search, Loader2, ArrowRight, Users, FolderKanban, BookOpen,
  Hash, X, Command, FileText, Building2, Database, Notebook,
} from "lucide-react";
import { cn } from "@/lib/utils";

function highlightText(text: string | null | undefined, query: string): React.ReactNode {
  if (!text) return <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>;
  if (!query.trim()) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

const TYPE_CONFIG = {
  client: { icon: Users, label: "Clients", color: "hsl(220, 90%, 62%)", bg: "hsl(220, 90%, 62%, 0.1)" },
  project: { icon: FolderKanban, label: "Projects", color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.1)" },
  snippet: { icon: BookOpen, label: "Knowledge", color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.1)" },
  vault: { icon: Notebook, label: "Obsidian Vault", color: "hsl(315, 70%, 60%)", bg: "hsl(315, 70%, 60%, 0.1)" },
} as const;

type SourceType = "client" | "project" | "snippet" | "vault";

// Source filter options
const SOURCE_FILTERS = [
  { id: "all", label: "All" },
  { id: "os", label: "NexoFlow OS", icon: Database },
  { id: "vault", label: "Obsidian Vault", icon: Notebook },
] as const;

type SourceFilter = (typeof SOURCE_FILTERS)[number]["id"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeType, setActiveType] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [vaultLoading, setVaultLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const searchSources = sourceFilter === "all"
    ? "all"
    : sourceFilter === "os"
      ? "os_only"
      : "vault_only";

  const { data, isLoading } = api.search.unifiedSearch.useQuery(
    { query: debouncedQuery, sources: searchSources as any },
    { enabled: debouncedQuery.trim().length > 0 },
  );

  // Track vault loading state
  useEffect(() => {
    if (isLoading && debouncedQuery) {
      const wantsVault = sourceFilter === "all" || sourceFilter === "vault";
      if (wantsVault) setVaultLoading(true);
    }
    if (!isLoading) setVaultLoading(false);
  }, [isLoading, sourceFilter, debouncedQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allResults = [
    ...(data?.grouped?.clients ?? []).map((r) => ({ ...r, type: "client" as SourceType, source: r.source as string })),
    ...(data?.grouped?.projects ?? []).map((r) => ({ ...r, type: "project" as SourceType, source: r.source as string })),
    ...(data?.grouped?.snippets ?? []).map((r) => ({ ...r, type: "snippet" as SourceType, source: r.source as string })),
    ...(data?.grouped?.vault ?? []).map((r) => ({ ...r, type: "vault" as SourceType, source: "vault" as string })),
  ];

  const filteredResults = activeType === "all"
    ? allResults
    : allResults.filter((r) => r.type === activeType);

  const total = data?.total ?? 0;
  const vaultAvailable = data?.vaultAvailable ?? false;
  const vaultCount = data?.vaultResultsCount ?? 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Search</h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Unified search across clients, projects, knowledge, and Obsidian vault
        </p>
      </div>

      {/* Search bar */}
      <div
        className="rounded-2xl p-1 mb-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, projects, knowledge, vault…"
            className="w-full pl-11 pr-24 py-3.5 text-sm bg-transparent border-none outline-none"
            style={{ color: "var(--text-primary)" }}
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1 rounded hover:bg-white/[0.05]"
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>
            )}
            <kbd
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", border: "1px solid var(--surface-border)" }}
            >
              {typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K"}
            </kbd>
          </div>
        </div>
      </div>

      {/* Source filter pills */}
      {debouncedQuery && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {SOURCE_FILTERS.map((f) => {
            const Icon = (f as any).icon;
            const active = sourceFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSourceFilter(f.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={
                  active
                    ? { background: "var(--surface-card)", color: "var(--text-primary)", border: "1px solid var(--surface-border)" }
                    : { color: "var(--text-muted)" }
                }
              >
                {Icon && <Icon className="w-3 h-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Type filters */}
      {debouncedQuery && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setActiveType("all")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              activeType === "all"
                ? { background: "var(--surface-card)", color: "var(--text-primary)", border: "1px solid var(--surface-border)" }
                : { color: "var(--text-muted)" }
            }
          >
            All ({total})
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => {
            let count = 0;
            if (key === "vault") count = vaultCount;
            else count = data?.grouped?.[key as keyof typeof data.grouped]?.length ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveType(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={
                  activeType === key
                    ? { background: config.bg, color: config.color, border: "1px solid transparent" }
                    : { color: "var(--text-muted)" }
                }
              >
                <config.icon className="w-3 h-3" />{config.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {!debouncedQuery ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search className="w-12 h-12 mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Search across clients, projects, knowledge, and Obsidian vault
          </p>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)" }}>
              <kbd className="font-mono">⌘K</kbd> to focus
            </span>
            <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)" }}>
              <kbd className="font-mono">Esc</kbd> to clear
            </span>
          </div>
          {!vaultAvailable && (
            <div className="mt-6 flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "hsl(39, 80%, 50%, 0.1)", color: "hsl(39, 80%, 50%)", border: "1px solid hsl(39, 80%, 50%, 0.2)" }}>
              <Notebook className="w-3 h-3" />
              Obsidian vault not available — set OBSIDIAN_LOCAL_API_URL to enable
            </div>
          )}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : (
        <>
          {/* Vault loading spinner */}
          {vaultLoading && (
            <div className="flex items-center gap-2 mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "hsl(315, 70%, 60%, 0.1)", color: "hsl(315, 70%, 60%)" }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking vault…
            </div>
          )}

          {total === 0 && !vaultLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Hash className="w-10 h-10 mb-4" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No results for &ldquo;{debouncedQuery}&rdquo;
              </p>
              {!vaultAvailable && (
                <div className="mt-4 flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "hsl(39, 80%, 50%, 0.1)", color: "hsl(39, 80%, 50%)", border: "1px solid hsl(39, 80%, 50%, 0.2)" }}>
                  <Notebook className="w-3 h-3" />
                  Obsidian vault unavailable — results limited to database
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vault results */}
              {(!activeType || activeType === "all" || activeType === "vault") && data?.grouped?.vault && data.grouped.vault.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Notebook className="w-4 h-4" style={{ color: TYPE_CONFIG.vault.color }} />
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Obsidian Vault</h2>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>({data.grouped.vault.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.grouped.vault.map((item, idx) => (
                      <a
                        key={`vault-${item.id ?? idx}`}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.02] group"
                        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: TYPE_CONFIG.vault.bg }}>
                          <Notebook className="w-4 h-4" style={{ color: TYPE_CONFIG.vault.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {highlightText(item.title ?? "", debouncedQuery)}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: "hsl(315, 70%, 60%, 0.15)", color: "hsl(315, 70%, 60%)" }}>
                              Obsidian Vault
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                              {highlightText(item.description, debouncedQuery)}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Clients */}
              {(!activeType || activeType === "all" || activeType === "client") && data?.grouped?.clients && data.grouped.clients.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" style={{ color: TYPE_CONFIG.client.color }} />
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Clients</h2>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>({data.grouped.clients.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.grouped.clients.map((item) => (
                      <Link
                        key={`client-${item.id}`}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.02] group"
                        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: "var(--brand-gradient)" }}>
                          {(item.title ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {highlightText(item.title, debouncedQuery)}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: "hsl(220, 90%, 62%, 0.15)", color: "hsl(220, 90%, 62%)" }}>
                              NexoFlow OS
                            </span>
                          </div>
                          {item.subtitle && (
                            <div className="text-xs truncate flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                              <Building2 className="w-3 h-3 shrink-0" />
                              {highlightText(item.subtitle, debouncedQuery)}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {(!activeType || activeType === "all" || activeType === "project") && data?.grouped?.projects && data.grouped.projects.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban className="w-4 h-4" style={{ color: TYPE_CONFIG.project.color }} />
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Projects</h2>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>({data.grouped.projects.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.grouped.projects.map((item) => (
                      <Link
                        key={`project-${item.id}`}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.02] group"
                        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: TYPE_CONFIG.project.bg }}>
                          <FolderKanban className="w-4 h-4" style={{ color: TYPE_CONFIG.project.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {highlightText(item.title, debouncedQuery)}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: "hsl(142, 68%, 52%, 0.15)", color: "hsl(142, 68%, 52%)" }}>
                              NexoFlow OS
                            </span>
                          </div>
                          <div className="text-xs truncate flex items-center gap-2 mt-0.5">
                            <span style={{ color: TYPE_CONFIG.project.color }}>{item.subtitle}</span>
                            {item.description && (
                              <span style={{ color: "var(--text-muted)" }}>
                                · {highlightText(item.description, debouncedQuery)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge Snippets */}
              {(!activeType || activeType === "all" || activeType === "snippet") && data?.grouped?.snippets && data.grouped.snippets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4" style={{ color: TYPE_CONFIG.snippet.color }} />
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Knowledge</h2>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>({data.grouped.snippets.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.grouped.snippets.map((item) => (
                      <Link
                        key={`snippet-${item.id}`}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.02] group"
                        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: TYPE_CONFIG.snippet.bg }}>
                          <BookOpen className="w-4 h-4" style={{ color: TYPE_CONFIG.snippet.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {highlightText(item.title, debouncedQuery)}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: "hsl(262, 83%, 68%, 0.15)", color: "hsl(262, 83%, 68%)" }}>
                              NexoFlow OS
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: TYPE_CONFIG.snippet.bg, color: TYPE_CONFIG.snippet.color }}>
                              {item.subtitle}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                              {highlightText(item.description, debouncedQuery)}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
