"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";

type SyncHealth = "healthy" | "warning" | "error";

const STATUS_CONFIG: Record<SyncHealth, { dot: string; bg: string; label: string }> = {
  healthy: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Synced",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    label: "Never synced",
  },
  error: {
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    label: "Sync error",
  },
};

export function SyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const { data, refetch, isLoading } = api.sync.status.useQuery(undefined, {
    refetchInterval: 30_000, // Poll every 30s
  });

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      // Call the sync script via a trivial endpoint (or just refetch status)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await refetch();
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Checking sync...
        </span>
      </div>
    );
  }

  if (!data) return null;

  const health: SyncHealth = data.health === "healthy" ? "healthy"
    : data.health === "error" ? "error" : "warning";
  const config = STATUS_CONFIG[health];

  const lastSyncStr = data.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 space-y-1.5",
        syncing ? "bg-amber-500/5" : config.bg,
      )}
      style={{
        border: `1px solid ${
          syncing ? "hsl(48, 96%, 53%, 0.2)" : "var(--surface-border-subtle)"
        }`,
      }}
    >
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              syncing ? "bg-amber-500 animate-pulse" : config.dot,
            )}
          />
          <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {syncing ? "Syncing..." : config.label}
          </span>
        </div>

        <button
          onClick={triggerSync}
          disabled={syncing}
          className="p-1 rounded transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: "var(--text-muted)" }}
          title="Sync Now"
        >
          <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
        </button>
      </div>

      {/* Details */}
      <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
        {lastSyncStr && (
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {lastSyncStr}
          </span>
        )}
        <span>{data.totalSnippets} snippets</span>
        <span>{data.totalCategories} categories</span>
      </div>

      {/* Error message */}
      {data.errorMessage && (
        <div className="flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: "var(--status-error)" }}>
          <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
          <span>{data.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
