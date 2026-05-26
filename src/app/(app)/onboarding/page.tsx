"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { CheckCircle2, Circle, Clock, Users, Loader2, Plus, ChevronDown, ChevronRight, Zap } from "lucide-react";

const STATUS_CONFIG = {
  todo:        { label: "To Do",       color: "hsl(220,20%,55%)",  bg: "hsl(220,20%,55%,0.12)" },
  in_progress: { label: "In Progress", color: "hsl(35,90%,60%)",   bg: "hsl(35,90%,60%,0.12)"  },
  done:        { label: "Done",        color: "hsl(142,68%,52%)",  bg: "hsl(142,68%,52%,0.12)" },
  skipped:     { label: "Skipped",     color: "hsl(220,20%,40%)",  bg: "hsl(220,20%,40%,0.12)" },
};

const CATEGORY_COLORS: Record<string, string> = {
  setup:    "hsl(220,90%,62%)",
  docs:     "hsl(262,83%,68%)",
  kickoff:  "hsl(35,90%,60%)",
  billing:  "hsl(142,68%,52%)",
};

export default function OnboardingPage() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const { data: clients = [], isLoading: clientsLoading } = api.clients.list.useQuery({});
  const { data: summary = {} } = api.onboarding.summary.useQuery();

  const clientList = (clients as any[]);

  function toggleClient(id: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSelectedClientId(id);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Client Onboarding</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>Automated checklists to ensure every client gets a flawless first week</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Clients", value: String(clientList.length), color: "hsl(220,90%,62%)", icon: Users },
          { label: "With Checklists", value: String(Object.keys(summary).length), color: "hsl(262,83%,68%)", icon: CheckCircle2 },
          { label: "Completed Tasks", value: String(Object.values(summary as Record<string, { done: number; total: number }>).reduce((s, v) => s + v.done, 0)), color: "hsl(142,68%,52%)", icon: Zap },
        ].map(({ label, value, color, icon: Icon }) => (
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

      {/* Client list with checklists */}
      {clientsLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : clientList.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No clients yet</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Add a client to create their onboarding checklist</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientList.map((client: any) => {
            const prog = (summary as Record<string, { done: number; total: number }>)[client.id];
            const isExpanded = expandedClients.has(client.id);
            const pct = prog ? Math.round((prog.done / prog.total) * 100) : 0;

            return (
              <div key={client.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-elevated)] transition-colors"
                  onClick={() => toggleClient(client.id)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: "var(--brand-gradient)" }}>
                    {(client.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{client.name}</div>
                    {prog ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)", maxWidth: 160 }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "hsl(142,68%,52%)" : "var(--brand-gradient)" }} />
                        </div>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{prog.done}/{prog.total} tasks</span>
                      </div>
                    ) : (
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>No checklist yet</div>
                    )}
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
                </button>

                {isExpanded && <ClientChecklist clientId={client.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientChecklist({ clientId }: { clientId: string }) {
  const { data: tasks = [], refetch } = api.onboarding.listByClient.useQuery({ clientId });
  const seedMutation = api.onboarding.seed.useMutation({ onSuccess: () => void refetch() });
  const updateMutation = api.onboarding.updateStatus.useMutation({ onSuccess: () => void refetch() });
  const deleteMutation = api.onboarding.delete.useMutation({ onSuccess: () => void refetch() });

  const taskList = tasks as any[];

  if (taskList.length === 0) {
    return (
      <div className="px-5 py-6 text-center" style={{ borderTop: "1px solid var(--surface-border)" }}>
        <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>No checklist yet for this client.</p>
        <button
          onClick={() => seedMutation.mutate({ clientId })}
          disabled={seedMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white mx-auto"
          style={{ background: "var(--brand-gradient)", opacity: seedMutation.isPending ? 0.7 : 1 }}
        >
          <Zap className="w-3.5 h-3.5" />
          {seedMutation.isPending ? "Generating…" : "Auto-generate Checklist"}
        </button>
      </div>
    );
  }

  const groups = taskList.reduce((acc: Record<string, any[]>, t: any) => {
    const cat = t.task.category ?? "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(t);
    return acc;
  }, {});

  return (
    <div style={{ borderTop: "1px solid var(--surface-border)" }}>
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: CATEGORY_COLORS[cat] ?? "var(--text-muted)", background: "var(--surface-elevated)" }}>
            {cat}
          </div>
          {(items as any[]).map((row: any) => {
            const task = row.task;
            const cfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
            return (
              <div key={task.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}>
                <button
                  onClick={() => updateMutation.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" })}
                  className="shrink-0"
                >
                  {task.status === "done"
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: "hsl(142,68%,52%)" }} />
                    : <Circle className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${task.status === "done" ? "line-through opacity-50" : ""}`} style={{ color: "var(--text-primary)" }}>{task.title}</span>
                  {task.description && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{task.description}</div>}
                </div>
                <select
                  value={task.status}
                  onChange={(e) => updateMutation.mutate({ id: task.id, status: e.target.value as any })}
                  className="text-[11px] rounded-full px-2 py-1 font-semibold"
                  style={{ background: cfg.bg, color: cfg.color, border: "none", outline: "none" }}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="skipped">Skip</option>
                </select>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
