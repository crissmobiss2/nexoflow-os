"use client";

import { use, useState } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, RefreshCw, ChevronRight, Edit2, Save, X, Eye } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

export default function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [preview, setPreview] = useState(false);

  const { data: artifact, isLoading, refetch } = api.projects.getArtifact.useQuery({
    projectId: id,
    artifactType: "scope_doc",
  });
  const { data: project } = api.projects.get.useQuery({ id });

  const generateScope = api.projects.generateScope.useMutation({
    onSuccess: () => void refetch(),
  });

  const updateArtifact = api.projects.updateArtifact.useMutation({
    onSuccess: () => { void refetch(); setEditing(false); },
  });

  function startEditing() {
    setEditContent(artifact?.content ?? "");
    setEditing(true);
    setPreview(false);
  }

  function cancelEditing() {
    setEditing(false);
    setPreview(false);
  }

  function saveEdits() {
    if (!artifact) return;
    updateArtifact.mutate({ projectId: id, artifactType: "scope_doc", content: editContent });
  }

  function exportMd() {
    const content = editing ? editContent : (artifact?.content ?? "");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "scope"} - Scope Document.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href={`/projects/${id}`} className="hover:opacity-80 flex items-center gap-1.5 transition-opacity">
            <ArrowLeft className="w-3.5 h-3.5" />
            {project?.name ?? "Project"}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          <span style={{ color: "var(--text-primary)" }}>Scope Document</span>
        </div>
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>No scope document yet.</p>
          <button
            onClick={() => generateScope.mutate({ projectId: id })}
            disabled={generateScope.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white mx-auto disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            {generateScope.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generateScope.isPending ? "Generating…" : "Generate Scope Document"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        <Link href={`/projects/${id}`} className="hover:opacity-80 flex items-center gap-1.5 transition-opacity">
          <ArrowLeft className="w-3.5 h-3.5" />
          {project?.name ?? "Project"}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
        <span style={{ color: "var(--text-primary)" }}>Scope Document</span>
        {editing && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "hsl(35,90%,58%,0.15)", color: "hsl(35,90%,58%)" }}>Editing</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Scope Document</h1>
          {artifact.modelUsed && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {artifact.modelUsed}
              {artifact.promptTokens != null
                ? ` · ${((artifact.promptTokens + (artifact.completionTokens ?? 0)) / 1000).toFixed(1)}K tokens`
                : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-card)" }}
              >
                <Eye className="w-3.5 h-3.5" />
                {preview ? "Edit" : "Preview"}
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-card)" }}
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={updateArtifact.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
                style={{ background: "var(--brand-gradient)" }}
              >
                {updateArtifact.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-card)" }}
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => generateScope.mutate({ projectId: id })}
                disabled={generateScope.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-card)" }}
              >
                {generateScope.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate
              </button>
              <button
                onClick={exportMd}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-card)" }}
              >
                <Download className="w-3.5 h-3.5" /> Export .md
              </button>
            </>
          )}
        </div>
      </div>

      {editing && !preview ? (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--surface-border)" }}>
          <div className="px-4 py-2 text-xs font-semibold" style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--surface-border)", color: "var(--text-muted)" }}>
            Markdown Editor · Changes are saved when you click Save
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full font-mono text-sm resize-none focus:outline-none"
            style={{
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              padding: "24px",
              minHeight: 600,
              lineHeight: 1.7,
            }}
          />
        </div>
      ) : (
        <div
          className="rounded-xl p-8 md:p-12"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div
            className="prose-nexoflow"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(editing ? editContent : artifact.content) }}
          />
        </div>
      )}
    </div>
  );
}
