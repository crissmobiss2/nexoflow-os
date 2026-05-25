"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Loader2, Shield, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default function ApiKeysPage() {
  const utils = api.useUtils();
  const { data: keys = [], isLoading } = api.apiKeys.list.useQuery();
  const createKey = api.apiKeys.create.useMutation({
    onSuccess: () => { void utils.apiKeys.list.invalidate(); },
  });
  const deleteKey = api.apiKeys.delete.useMutation({
    onSuccess: () => { void utils.apiKeys.list.invalidate(); },
  });

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermissions, setNewPermissions] = useState("read");
  const [createdKey, setCreatedKey] = useState<{ name: string; fullKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    const result = await createKey.mutateAsync({
      name: newName.trim(),
      permissions: newPermissions,
    });
    setCreatedKey({ name: result.name, fullKey: result.fullKey });
    setNewName("");
    setNewPermissions("read");
    setShowNewForm(false);

    setTimeout(() => setCreatedKey(null), 60000);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>API Keys</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            Manage API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> Create Key
        </button>
      </div>

      {/* New key created notification */}
      {createdKey && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: "hsl(142 68% 52% / 0.1)", border: "1px solid hsl(142 68% 52% / 0.3)" }}
        >
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--status-success)" }} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--status-success)" }}>
                API Key Created: Copy it now!
              </h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                You won't be able to see this key again. Store it somewhere safe.
              </p>
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl font-mono text-sm break-all"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
              >
                <span style={{ color: "var(--text-primary)" }}>{createdKey.fullKey}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(createdKey.fullKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => setCreatedKey(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New key form */}
      {showNewForm && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>New API Key</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Key Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline, Dev Tooling"
                className="nf-input"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Permissions</label>
              <select value={newPermissions} onChange={(e) => setNewPermissions(e.target.value)} className="nf-input">
                <option value="read">Read-only</option>
                <option value="read,write">Read + Write</option>
                <option value="read,write,admin">Full Access (admin)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || createKey.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--brand-gradient)" }}
              >
                {createKey.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                Generate Key
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : keys.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "hsl(220 90% 62% / 0.1)" }}
          >
            <Key className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No API keys yet</h2>
          <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-secondary)" }}>
            Create an API key to integrate NexoFlow with your CI/CD pipelines, tools, and automations.
          </p>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> Create first key
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="rounded-xl p-4 transition-colors group"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: key.isActive ? "hsl(220 90% 62% / 0.15)" : "hsl(0 0% 50% / 0.1)" }}
                  >
                    <Key className="w-4 h-4" style={{ color: key.isActive ? "var(--brand-primary)" : "var(--text-muted)" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{key.name}</span>
                      {!key.isActive && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(0 80% 65% / 0.15)", color: "var(--status-error)" }}>
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--surface-elevated)", color: "var(--text-muted)" }}>
                        {key.keyPrefix}…{key.keyLastChars}
                      </code>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        · {key.permissions}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {key.lastUsedAt ? (
                    <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(key.lastUsedAt)}
                    </div>
                  ) : (
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Never used</span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete API key "${key.name}"? This cannot be undone.`)) {
                        deleteKey.mutate({ id: key.id });
                      }
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10"
                    title="Delete key"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--status-error)" }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
