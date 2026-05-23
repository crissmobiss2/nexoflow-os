"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/trpc/client";
import { ScrollText, Filter, Loader2, ChevronLeft, ChevronRight, Search, User, Target, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  create: { color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  update: { color: "hsl(207, 90%, 62%)", bg: "hsl(207, 90%, 62%, 0.12)" },
  delete: { color: "hsl(0, 80%, 65%)", bg: "hsl(0, 80%, 65%, 0.12)" },
  generate: { color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.12)" },
};

export default function AuditLogPage() {
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: actions = [] } = api.auditLog.distinctActions.useQuery();
  const { data: targetTypes = [] } = api.auditLog.distinctTargetTypes.useQuery();
  const { data: users = [] } = api.auditLog.distinctUsers.useQuery();

  const { data, isLoading } = api.auditLog.list.useQuery({
    limit: 30,
    offset,
    action: filterAction || undefined,
    userId: filterUser || undefined,
    targetType: filterTarget || undefined,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  useEffect(() => { setOffset(0); }, [filterAction, filterUser, filterTarget]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Audit Log</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            Track all changes and actions across the system
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 mb-5 flex items-center gap-4 flex-wrap"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <Filter className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="nf-input w-auto min-w-[120px]"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value)}
          className="nf-input w-auto min-w-[140px]"
        >
          <option value="">All targets</option>
          {targetTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="nf-input w-auto min-w-[160px]"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.userId ?? ""} value={u.userId ?? ""}>{u.userName ?? u.userId}</option>
          ))}
        </select>
        {(filterAction || filterTarget || filterUser) && (
          <button
            onClick={() => { setFilterAction(""); setFilterTarget(""); setFilterUser(""); }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", background: "var(--surface-elevated)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : logs.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <ScrollText className="w-10 h-10 mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {filterAction || filterTarget || filterUser ? "No audit logs match your filters." : "No audit logs yet. Actions will appear here as you use the system."}
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            {/* Column headers */}
            <div
              className="grid px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "160px 140px 120px 1fr 40px", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--surface-border)" }}
            >
              <span>Timestamp</span>
              <span>User</span>
              <span>Action</span>
              <span>Target</span>
              <span />
            </div>

            {logs.map((log) => {
              const actionColors = ACTION_COLORS[log.action] ?? { color: "var(--text-secondary)", bg: "var(--surface-elevated)" };
              let detailsObj: Record<string, unknown> | null = null;
              try {
                if (log.details) detailsObj = JSON.parse(log.details);
              } catch { /* ignore */ }

              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full grid items-center px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
                    style={{ gridTemplateColumns: "160px 140px 120px 1fr 40px", gap: "0.75rem", borderBottom: "1px solid var(--surface-border-subtle)" }}
                  >
                    <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span className="text-xs truncate flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                      {log.userName ?? "System"}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                      style={{ background: actionColors.bg, color: actionColors.color }}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs truncate flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <Target className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                      {log.targetType}
                      {log.targetId && (
                        <code className="text-[10px] font-mono ml-1" style={{ color: "var(--text-muted)" }}>
                          #{log.targetId.slice(0, 8)}
                        </code>
                      )}
                    </span>
                    <ChevronRight
                      className={cn("w-3.5 h-3.5 transition-transform", expandedId === log.id && "rotate-90")}
                      style={{ color: "var(--text-muted)" }}
                    />
                  </button>

                  {/* Expanded details */}
                  {expandedId === log.id && detailsObj && (
                    <div
                      className="px-5 py-3"
                      style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--surface-border-subtle)" }}
                    >
                      <pre className="text-xs font-mono overflow-auto max-h-48 p-3 rounded-lg" style={{ background: "var(--surface-bg)", color: "var(--text-secondary)" }}>
                        {JSON.stringify(detailsObj, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div className="flex items-center justify-center gap-3 py-4 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - 30))}
                disabled={offset === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-30"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {offset + 1}–{Math.min(offset + 30, total)} of {total.toLocaleString()}
              </span>
              <button
                onClick={() => setOffset(offset + 30)}
                disabled={offset + 30 >= total}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-30"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
