"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { BookOpen, Pin, Plus, Search, Edit2, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";

const CATEGORIES = ["SOP", "Pricing", "Service", "Onboarding", "Technical", "Sales", "HR", "Other"];

export default function WikiPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", category: "", pinned: false });

  const { data: pages = [], refetch } = api.wiki.list.useQuery({ search: search || undefined, category });
  const createMutation = api.wiki.create.useMutation({ onSuccess: () => { void refetch(); setShowNew(false); setForm({ title: "", content: "", category: "", pinned: false }); } });
  const updateMutation = api.wiki.update.useMutation({ onSuccess: () => { void refetch(); setEditId(null); } });
  const deleteMutation = api.wiki.delete.useMutation({ onSuccess: () => void refetch() });

  const pageList = pages as any[];

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    createMutation.mutate({ title: form.title, content: form.content, category: form.category || undefined, pinned: form.pinned });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Internal Wiki</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>SOPs, pricing guides, service packages, and internal processes</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> New Page
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search wiki…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }}
          />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setCategory(undefined)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={!category ? { background: "var(--brand-gradient)", color: "#fff" } : { background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>All</button>
          {CATEGORIES.slice(0, 5).map((c) => (
            <button key={c} onClick={() => setCategory(c === category ? undefined : c)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={category === c ? { background: "var(--brand-gradient)", color: "#fff" } : { background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>{c}</button>
          ))}
        </div>
      </div>

      {/* New page form */}
      {showNew && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Wiki Page</div>
            <button onClick={() => setShowNew(false)}><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
          </div>
          <form onSubmit={submitNew} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Discovery Call SOP" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }} required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }}>
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Content (Markdown supported)</label>
              <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={8} placeholder="Write your SOP, guide, or process here…" className="w-full rounded-lg px-3 py-2 text-sm font-mono resize-y" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }} />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Pin to top</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
                  {createMutation.isPending ? "Saving…" : "Create Page"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Pages list */}
      {pageList.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No wiki pages yet</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Create your first SOP, pricing guide, or internal process doc</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pageList.map((row: any) => {
            const page = row.page;
            const isExpanded = expandedId === page.id;
            return (
              <div key={page.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {page.pinned && <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(35,90%,60%)" }} />}
                      <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{page.title}</span>
                      {page.category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262,83%,68%)" }}>{page.category}</span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {row.authorName ?? "Unknown"} · {new Date(page.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : page.id)} className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors" style={{ color: "var(--text-muted)" }}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditId(page.id); setExpandedId(page.id); }} className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors" style={{ color: "var(--text-muted)" }}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteMutation.mutate({ id: page.id })} className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors" style={{ color: "var(--text-muted)" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--surface-border)" }}>
                    {editId === page.id
                      ? <WikiEditor page={page} onSave={(data) => { updateMutation.mutate({ id: page.id, ...data }); }} onCancel={() => setEditId(null)} saving={updateMutation.isPending} />
                      : <div className="px-5 py-4 text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)", fontFamily: "inherit" }}>{page.content || <span style={{ color: "var(--text-muted)" }}>No content yet.</span>}</div>
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WikiEditor({ page, onSave, onCancel, saving }: { page: any; onSave: (d: any) => void; onCancel: () => void; saving: boolean }) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content ?? "");
  const [category, setCategory] = useState(page.category ?? "");
  const [pinned, setPinned] = useState(page.pinned ?? false);

  return (
    <div className="px-5 py-4 space-y-3">
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full rounded-lg px-3 py-2 text-sm font-mono resize-y" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", outline: "none" }} />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Pinned</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>Cancel</button>
          <button onClick={() => onSave({ title, content, category, pinned })} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
