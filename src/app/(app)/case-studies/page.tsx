"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import {
  Star, Plus, Eye, EyeOff, Trash2, Edit3, CheckCircle2, Loader2, Quote, Sparkles,
} from "lucide-react";

type CS = {
  id: string;
  clientName: string;
  clientTitle?: string | null;
  clientCompany?: string | null;
  clientIndustry?: string | null;
  avatarInitials?: string | null;
  testimonial: string;
  metric1Label?: string | null;
  metric1Value?: string | null;
  metric2Label?: string | null;
  metric2Value?: string | null;
  metric3Label?: string | null;
  metric3Value?: string | null;
  published: boolean;
  sortOrder: number;
};

function cleanForm(f: typeof BLANK) {
  return {
    clientName: f.clientName,
    testimonial: f.testimonial,
    clientTitle: f.clientTitle || undefined,
    clientCompany: f.clientCompany || undefined,
    clientIndustry: f.clientIndustry || undefined,
    avatarInitials: f.avatarInitials || undefined,
    metric1Label: f.metric1Label || undefined,
    metric1Value: f.metric1Value || undefined,
    metric2Label: f.metric2Label || undefined,
    metric2Value: f.metric2Value || undefined,
    metric3Label: f.metric3Label || undefined,
    metric3Value: f.metric3Value || undefined,
    linkedProjectId: undefined as string | undefined,
    linkedClientId: undefined as string | undefined,
  };
}

const BLANK: Omit<CS, "id" | "published" | "sortOrder"> = {
  clientName: "", clientTitle: "", clientCompany: "", clientIndustry: "", avatarInitials: "",
  testimonial: "", metric1Label: "", metric1Value: "", metric2Label: "", metric2Value: "",
  metric3Label: "", metric3Value: "",
};

function MetricBadge({ label, value }: { label?: string | null; value?: string | null }) {
  if (!value || !label) return null;
  return (
    <div className="text-center">
      <div className="text-lg font-bold" style={{ color: "var(--brand-primary)" }}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

export default function CaseStudiesPage() {
  const [editing, setEditing] = useState<CS | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<typeof BLANK>(BLANK);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiForm, setAiForm] = useState({ clientName: "", company: "", industry: "", projectDescription: "", outcome: "" });

  const { data: studies = [], isLoading, refetch } = api.caseStudies.list.useQuery();
  const generateWithAi = api.caseStudies.generateWithAi.useMutation({
    onSuccess: () => {
      void refetch();
      setShowAiGen(false);
      setAiForm({ clientName: "", company: "", industry: "", projectDescription: "", outcome: "" });
    },
  });
  const createMutation = api.caseStudies.create.useMutation({
    onSuccess: () => { void refetch(); setIsNew(false); setForm(BLANK); setSaveError(null); },
    onError: (e) => setSaveError(e.message),
  });
  const updateMutation = api.caseStudies.update.useMutation({
    onSuccess: () => { void refetch(); setEditing(null); setSaveError(null); },
    onError: (e) => setSaveError(e.message),
  });
  const publishMutation = api.caseStudies.publish.useMutation({ onSuccess: () => void refetch() });
  const deleteMutation = api.caseStudies.delete.useMutation({ onSuccess: () => void refetch() });

  function openNew() { setForm(BLANK); setIsNew(true); setEditing(null); setSaveError(null); }
  function openEdit(cs: CS) { setEditing(cs); setForm({ ...cs }); setIsNew(false); setSaveError(null); }
  function closeForm() { setIsNew(false); setEditing(null); setSaveError(null); }

  function handleSave() {
    if (!form.clientName.trim() || !form.testimonial.trim()) {
      setSaveError("Client name and testimonial are required.");
      return;
    }
    if (isNew) {
      createMutation.mutate(cleanForm(form));
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, ...cleanForm(form) });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Case Studies</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {studies.filter((s) => s.published).length} published · {studies.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAiGen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "hsl(270 70% 65% / 0.12)", color: "hsl(270, 70%, 65%)", border: "1px solid hsl(270 70% 65% / 0.25)" }}
          >
            <Sparkles className="w-4 h-4" /> AI Generate
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> Add Case Study
          </button>
        </div>
      </div>

      {/* AI Generate Panel */}
      {showAiGen && (
        <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-card)", border: "1px solid hsl(270 70% 65% / 0.3)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4" style={{ color: "hsl(270, 70%, 65%)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Case Study Generator</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {([
              ["clientName", "Client Name *"],
              ["company", "Company"],
              ["industry", "Industry"],
              ["outcome", "Key Outcome (e.g. 3x revenue in 6 months)"],
            ] as [keyof typeof aiForm, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
                <input
                  value={aiForm[key]}
                  onChange={(e) => setAiForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Project Description *</label>
            <textarea
              value={aiForm.projectDescription}
              onChange={(e) => setAiForm((f) => ({ ...f, projectDescription: e.target.value }))}
              rows={3}
              placeholder="Describe what you built/did for this client…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => generateWithAi.mutate(aiForm)}
              disabled={generateWithAi.isPending || !aiForm.clientName.trim() || !aiForm.projectDescription.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "hsl(270 70% 65% / 0.15)", color: "hsl(270, 70%, 65%)", border: "1px solid hsl(270 70% 65% / 0.3)" }}
            >
              {generateWithAi.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generateWithAi.isPending ? "Generating…" : "Generate with AI"}
            </button>
            <button
              onClick={() => setShowAiGen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {(isNew || editing) && (
        <div className="rounded-2xl p-6 mb-8" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <h2 className="text-sm font-semibold mb-5" style={{ color: "var(--text-primary)" }}>
            {isNew ? "New Case Study" : `Editing: ${editing?.clientName}`}
          </h2>

          {saveError && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "hsl(0 72% 58% / 0.1)", border: "1px solid hsl(0 72% 58% / 0.3)", color: "hsl(0 72% 68%)" }}>
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            {([
              ["clientName", "Client Name *"],
              ["clientTitle", "Title / Role"],
              ["clientCompany", "Company"],
              ["clientIndustry", "Industry"],
              ["avatarInitials", "Avatar Initials (e.g. JM)"],
            ] as [keyof typeof BLANK, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
                <input
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Testimonial *</label>
            <textarea
              value={form.testimonial}
              onChange={(e) => setForm((f) => ({ ...f, testimonial: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {([1, 2, 3] as const).map((n) => (
              <div key={n} className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Metric {n}</label>
                <input
                  placeholder="Value (e.g. 156%)"
                  value={form[`metric${n}Value` as keyof typeof BLANK] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [`metric${n}Value`]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                />
                <input
                  placeholder="Label (e.g. More Leads)"
                  value={form[`metric${n}Label` as keyof typeof BLANK] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [`metric${n}Label`]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--brand-gradient)" }}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isNew ? "Create Case Study" : "Save Changes"}
            </button>
            <button onClick={closeForm} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : studies.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center py-24 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <Star className="w-10 h-10 mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No case studies yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Add your first client success story.</p>
          <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="w-4 h-4" /> Add First Case Study
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {studies.map((cs) => (
            <div key={cs.id} className="rounded-2xl p-5"
              style={{ background: "var(--surface-card)", border: `1px solid ${cs.published ? "hsl(142 68% 52% / 0.3)" : "var(--surface-border)"}` }}>

              {/* Avatar + name */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "var(--brand-gradient)", color: "white" }}>
                    {cs.avatarInitials ?? cs.clientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cs.clientName}</div>
                    {cs.clientTitle && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{cs.clientTitle}{cs.clientCompany ? `, ${cs.clientCompany}` : ""}</div>}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cs.published ? "" : ""}`}
                  style={cs.published
                    ? { background: "hsl(142 68% 52% / 0.12)", color: "hsl(142, 68%, 52%)" }
                    : { background: "var(--surface-elevated)", color: "var(--text-muted)" }}>
                  {cs.published ? "Published" : "Draft"}
                </span>
              </div>

              {/* Testimonial */}
              <div className="flex gap-2 mb-4">
                <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-secondary)" }}>
                  {cs.testimonial}
                </p>
              </div>

              {/* Metrics */}
              {(cs.metric1Value || cs.metric2Value || cs.metric3Value) && (
                <div className="flex gap-6 mb-4 px-2 py-3 rounded-xl" style={{ background: "var(--surface-elevated)" }}>
                  <MetricBadge label={cs.metric1Label} value={cs.metric1Value} />
                  <MetricBadge label={cs.metric2Label} value={cs.metric2Value} />
                  <MetricBadge label={cs.metric3Label} value={cs.metric3Value} />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => publishMutation.mutate({ id: cs.id, published: !cs.published })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                  style={cs.published
                    ? { background: "hsl(0 70% 60% / 0.1)", color: "hsl(0, 70%, 60%)" }
                    : { background: "hsl(142 68% 52% / 0.12)", color: "hsl(142, 68%, 52%)" }}>
                  {cs.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {cs.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => openEdit(cs)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { if (confirm("Delete this case study?")) deleteMutation.mutate({ id: cs.id }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 ml-auto"
                  style={{ color: "hsl(0, 70%, 65%)" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
