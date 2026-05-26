"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { Plus, Clock, DollarSign, Trash2, Loader2, BarChart3 } from "lucide-react";

function fmt(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default function TimeTrackingPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ projectId: "", date: new Date().toISOString().slice(0, 10), hours: "1", minutes: "0", description: "", billable: true });

  const { data: entries = [], refetch } = api.timeTracking.list.useQuery();
  const { data: stats } = api.timeTracking.stats.useQuery();
  const { data: byProject = [] } = api.timeTracking.byProject.useQuery();
  const { data: projects = [] } = api.projects.list.useQuery({});

  const createMutation = api.timeTracking.create.useMutation({
    onSuccess: () => { void refetch(); setShowForm(false); setForm({ projectId: "", date: new Date().toISOString().slice(0, 10), hours: "1", minutes: "0", description: "", billable: true }); },
  });
  const deleteMutation = api.timeTracking.delete.useMutation({ onSuccess: () => void refetch() });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) return;
    const totalMinutes = parseInt(form.hours || "0") * 60 + parseInt(form.minutes || "0");
    if (totalMinutes < 1) return;
    createMutation.mutate({
      projectId: form.projectId,
      date: new Date(form.date),
      minutesLogged: totalMinutes,
      description: form.description || undefined,
      billable: form.billable,
    });
  }

  const billablePct = (stats?.totalMinutes ?? 0) > 0
    ? Math.round(((stats?.billableMinutes ?? 0) / stats!.totalMinutes) * 100)
    : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Time Tracking</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>Log hours against projects — track billable time and profitability</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> Log Time
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Hours", value: fmt(stats?.totalMinutes ?? 0), icon: Clock, color: "hsl(220,90%,62%)" },
          { label: "Billable Hours", value: fmt(stats?.billableMinutes ?? 0) + ` (${billablePct}%)`, icon: DollarSign, color: "hsl(142,68%,52%)" },
          { label: "Entries", value: String(stats?.entryCount ?? 0), icon: BarChart3, color: "hsl(262,83%,68%)" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}1a` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Log form */}
      {showForm && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Log Time Entry</div>
          <form onSubmit={submit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Project *</label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }}
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                required
              >
                <option value="">Select project…</option>
                {(projects as any[]).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Date *</label>
              <input
                type="date"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Time</label>
              <div className="flex gap-2">
                <input type="number" min="0" max="23" placeholder="Hours" className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} />
                <input type="number" min="0" max="59" step="15" placeholder="Min" className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }} value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Description</label>
              <input
                type="text"
                placeholder="What did you work on?"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.billable} onChange={(e) => setForm((f) => ({ ...f, billable: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Billable</span>
              </label>
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--brand-gradient)", opacity: createMutation.isPending ? 0.7 : 1 }}>
                  {createMutation.isPending ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* By project summary */}
      {byProject.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ borderBottom: "1px solid var(--surface-border)", color: "var(--text-muted)" }}>Hours by Project</div>
          {byProject.map((row) => {
            const pct = row.totalMinutes > 0 ? Math.round((row.billableMinutes / row.totalMinutes) * 100) : 0;
            return (
              <div key={row.projectId} className="px-5 py-3 flex items-center gap-4" style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{row.projectName ?? "Unknown"}</div>
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "hsl(142,68%,52%)" }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{fmt(row.totalMinutes)}</div>
                  <div className="text-[11px]" style={{ color: "hsl(142,68%,52%)" }}>{fmt(row.billableMinutes)} billable</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entry list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
        <div className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ borderBottom: "1px solid var(--surface-border)", color: "var(--text-muted)" }}>Recent Entries</div>
        {(entries as any[]).length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>No time entries yet. Click "Log Time" to get started.</div>
        ) : (
          (entries as any[]).slice(0, 50).map((row: any) => (
            <div key={row.entry.id} className="px-5 py-3 flex items-center gap-4" style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{row.projectName ?? "Unknown project"}</span>
                  {row.entry.billable && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: "hsl(142 68% 52% / 0.15)", color: "hsl(142,68%,52%)" }}>Billable</span>
                  )}
                </div>
                {row.entry.description && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{row.entry.description}</div>}
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {new Date(row.entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {row.userName && ` · ${row.userName}`}
                </div>
              </div>
              <div className="text-sm font-bold shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(row.entry.minutesLogged)}</div>
              <button
                onClick={() => deleteMutation.mutate({ id: row.entry.id })}
                disabled={deleteMutation.isPending}
                className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
