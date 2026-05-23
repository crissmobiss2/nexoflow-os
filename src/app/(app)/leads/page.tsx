"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers";
import {
  Target, Plus, Upload, Globe, Mail, Phone, Building2,
  Loader2, ArrowRight, Sparkles, ChevronDown, Trash2, CheckSquare, Square, X, Award,
} from "lucide-react";

const PIPELINE_STAGES: { key: string; label: string; color: string; bg: string }[] = [
  { key: "new",            label: "New",           color: "hsl(207, 70%, 60%)", bg: "hsl(207, 90%, 60%, 0.12)" },
  { key: "reviewing",      label: "Reviewing",     color: "hsl(35, 90%, 60%)",  bg: "hsl(35, 90%, 60%, 0.12)"  },
  { key: "demo_queued",    label: "Demo Queued",   color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.12)" },
  { key: "demo_generated", label: "Demo Ready",    color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.15)" },
  { key: "sent",           label: "Sent",          color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  { key: "replied",        label: "Replied",       color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.18)" },
  { key: "won",            label: "Won",           color: "hsl(142, 80%, 45%)", bg: "hsl(142, 80%, 45%, 0.18)" },
  { key: "lost",           label: "Lost",          color: "hsl(0, 70%, 60%)",   bg: "hsl(0, 70%, 60%, 0.12)"   },
  { key: "archived",       label: "Archived",      color: "hsl(220, 14%, 55%)", bg: "hsl(220, 14%, 55%, 0.1)"  },
];

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s]));

type ViewMode = "table" | "kanban";

export default function LeadsPage() {
  const [view, setView] = useState<ViewMode>("table");
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: allLeads = [], isLoading, refetch } = api.leads.list.useQuery(
    filterStatus ? { status: filterStatus as any } : undefined,
  );

  const bulkDelete = api.leads.bulkDelete.useMutation({
    onSuccess: () => { setSelected(new Set()); void refetch(); },
  });
  const bulkUpdateStatus = api.leads.bulkUpdateStatus.useMutation({
    onSuccess: () => { setSelected(new Set()); void refetch(); },
  });
  const bulkScrape = api.leads.bulkScrape.useMutation({
    onSuccess: (r) => {
      alert(`Scraped ${r.succeeded} · failed ${r.failed}`);
      setSelected(new Set());
      void refetch();
    },
  });
  const bulkGenerateDemo = api.leads.bulkGenerateDemo.useMutation({
    onSuccess: (r) => {
      alert(`Generated ${r.succeeded} demos · failed ${r.failed}`);
      setSelected(new Set());
      void refetch();
    },
  });

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(allLeads.map((l) => l.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  const counts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = allLeads.filter((l) => l.status === s.key).length;
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Lead Pipeline</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {allLeads.length} lead{allLeads.length !== 1 ? "s" : ""}
            {" · "}{allLeads.filter((l) => l.status === "won").length} won
            {" · "}{allLeads.filter((l) => ["sent", "replied"].includes(l.status)).length} active outreach
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-xl overflow-hidden text-xs font-semibold"
            style={{ border: "1px solid var(--surface-border)" }}
          >
            {(["table", "kanban"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-2 capitalize transition-colors"
                style={
                  view === v
                    ? { background: "var(--brand-gradient)", color: "white" }
                    : { background: "var(--surface-card)", color: "var(--text-secondary)" }
                }
              >
                {v}
              </button>
            ))}
          </div>
          <Link
            href="/leads/import"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Link>
          <Link
            href="/leads/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> Add Lead
          </Link>
        </div>
      </div>

      {/* Stage filter bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus(undefined)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={
            !filterStatus
              ? { background: "var(--brand-gradient)", color: "white" }
              : { background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }
          }
        >
          All ({allLeads.length})
        </button>
        {PIPELINE_STAGES.filter((s) => counts[s.key]! > 0 || !filterStatus).map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(filterStatus === s.key ? undefined : s.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              filterStatus === s.key
                ? { background: s.color, color: "white" }
                : { background: s.bg, color: s.color, border: `1px solid ${s.color}30` }
            }
          >
            {s.label} {counts[s.key] ? `(${counts[s.key]})` : ""}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4 sticky top-2 z-10"
          style={{ background: "var(--brand-gradient)", color: "white" }}
        >
          <span className="text-xs font-semibold">{selected.size} selected</span>
          <button onClick={clearSelection} className="text-xs underline opacity-90 hover:opacity-100">Clear</button>
          <button onClick={selectAll} className="text-xs underline opacity-90 hover:opacity-100">Select all</button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                if (selected.size > 20) { alert("Scraping is limited to 20 leads per batch."); return; }
                bulkScrape.mutate({ ids: [...selected] });
              }}
              disabled={bulkScrape.isPending || bulkGenerateDemo.isPending}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.15)" }}
              title="Scrape websites for up to 20 leads"
            >
              {bulkScrape.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Scrape
            </button>
            <button
              onClick={() => {
                if (selected.size > 10) { alert("Demo generation is limited to 10 leads per batch (Sonnet calls)."); return; }
                if (confirm(`Generate ${selected.size} demos? This will take ~${selected.size * 30}s and cost ~$${(selected.size * 0.04).toFixed(2)} in API.`)) {
                  bulkGenerateDemo.mutate({ ids: [...selected] });
                }
              }}
              disabled={bulkGenerateDemo.isPending || bulkScrape.isPending}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.15)" }}
              title="Auto-scrape, profile, and generate demos for up to 10 leads"
            >
              {bulkGenerateDemo.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
              Generate Demos
            </button>
            <select
              onChange={(e) => {
                if (e.target.value && confirm(`Move ${selected.size} leads to ${e.target.value}?`)) {
                  bulkUpdateStatus.mutate({ ids: [...selected], status: e.target.value as any });
                }
                e.target.value = "";
              }}
              defaultValue=""
              className="px-2 py-1 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              <option value="" disabled>Move to status…</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s.key} value={s.key} style={{ color: "#000" }}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (confirm(`Delete ${selected.size} leads permanently? This cannot be undone.`)) {
                  bulkDelete.mutate({ ids: [...selected] });
                }
              }}
              disabled={bulkDelete.isPending}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {bulkDelete.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : allLeads.length === 0 ? (
        <EmptyState />
      ) : view === "table" ? (
        <LeadTable leads={allLeads} selected={selected} onToggle={toggleSelect} />
      ) : (
        <KanbanView leads={allLeads} onRefetch={refetch} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center py-24 text-center"
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "hsl(220 90% 62% / 0.1)" }}
      >
        <Target className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
      </div>
      <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No leads yet</h2>
      <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-secondary)" }}>
        Import a CSV of scraped leads or add them manually to start your pipeline.
      </p>
      <div className="flex gap-3">
        <Link
          href="/leads/import"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: "var(--surface-elevated)", color: "var(--text-primary)", border: "1px solid var(--surface-border)" }}
        >
          <Upload className="w-4 h-4" /> Import CSV
        </Link>
        <Link
          href="/leads/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> Add first lead
        </Link>
      </div>
    </div>
  );
}

type RouterOutput = inferRouterOutputs<AppRouter>;
type Lead = RouterOutput["leads"]["list"][number];

function LeadTable({ leads: rows, selected, onToggle }: { leads: Lead[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <div
        className="grid px-6 py-3"
        style={{
          borderBottom: "1px solid var(--surface-border)",
          gridTemplateColumns: "20px 2fr 1.5fr 120px 100px 100px 16px",
          gap: "1rem",
        }}
      >
        {["", "Lead", "Company / Contact", "Industry", "Status", "Actions", ""].map((h, i) => (
          <div key={i} className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {h}
          </div>
        ))}
      </div>
      {rows.map((lead) => {
        const stage = STAGE_MAP[lead.status];
        const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Unnamed Lead";
        const isSelected = selected.has(lead.id);
        return (
          <div
            key={lead.id}
            className="grid items-center px-6 py-4"
            style={{
              borderBottom: "1px solid var(--surface-border-subtle)",
              gridTemplateColumns: "20px 2fr 1.5fr 120px 100px 100px 16px",
              gap: "1rem",
              background: isSelected ? "hsl(220 90% 62% / 0.05)" : undefined,
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => onToggle(lead.id)}
              className="p-0.5 rounded"
              style={{ color: isSelected ? "var(--brand-primary)" : "var(--text-muted)" }}
              aria-label={isSelected ? "Deselect" : "Select"}
            >
              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            {/* Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: "var(--brand-gradient)", color: "white" }}
              >
                {fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-sm font-medium truncate hover:underline block"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fullName}
                </Link>
                {lead.jobTitle && (
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{lead.jobTitle}</div>
                )}
              </div>
            </div>

            {/* Company / contact */}
            <div className="min-w-0">
              {lead.company && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{lead.company}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Mail className="w-2.5 h-2.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{lead.email}</span>
                </div>
              )}
            </div>

            {/* Industry */}
            <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {lead.industry ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
            </div>

            {/* Status */}
            <div>
              {stage && (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: stage.bg, color: stage.color }}
                >
                  {stage.label}
                </span>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-1.5">
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Visit website"
                  className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Globe className="w-3.5 h-3.5" />
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  title="Send email"
                  className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Mail className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <Link href={`/leads/${lead.id}`}>
              <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function KanbanView({ leads: rows, onRefetch }: { leads: Lead[]; onRefetch: () => void }) {
  const activeStages = PIPELINE_STAGES.filter((s) => s.key !== "archived");
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {activeStages.map((stage) => {
        const stageLeads = rows.filter((l) => l.status === stage.key);
        return (
          <div key={stage.key} className="shrink-0 w-64">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: stage.color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {stage.label}
              </span>
              <span
                className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: stage.bg, color: stage.color }}
              >
                {stageLeads.length}
              </span>
            </div>
            <div className="space-y-2">
              {stageLeads.map((lead) => {
                const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Unnamed";
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block rounded-xl p-3.5 transition-all hover:shadow-md"
                    style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                  >
                    <div className="text-sm font-semibold mb-1 truncate" style={{ color: "var(--text-primary)" }}>{fullName}</div>
                    {lead.company && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <Building2 className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{lead.company}</span>
                      </div>
                    )}
                    {lead.industry && (
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "hsl(220 90% 62% / 0.1)", color: "var(--brand-primary)" }}
                      >
                        {lead.industry}
                      </span>
                    )}
                    {lead.aiInsights && (
                      <div className="mt-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" style={{ color: "hsl(262, 83%, 68%)" }} />
                        <span className="text-[11px]" style={{ color: "hsl(262, 83%, 68%)" }}>AI insights ready</span>
                      </div>
                    )}
                  </Link>
                );
              })}
              {stageLeads.length === 0 && (
                <div
                  className="rounded-xl p-4 text-center text-xs"
                  style={{ border: "1px dashed var(--surface-border)", color: "var(--text-muted)" }}
                >
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
