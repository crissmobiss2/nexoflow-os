"use client";

import { use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, RefreshCw, ArrowRight, ChevronRight, Terminal } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

export default function ArchitecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: artifact, isLoading } = api.projects.getArtifact.useQuery({
    projectId: id,
    artifactType: "architecture",
  });
  const { data: project } = api.projects.get.useQuery({ id });
  const generateArch = api.projects.generateArchitecture.useMutation({
    onSuccess: () => window.location.reload(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>No architecture document found.</p>
        <Link href={`/projects/${id}`} className="text-sm hover:underline" style={{ color: "var(--brand-primary)" }}>
          ← Back to project
        </Link>
      </div>
    );
  }

  const exportMd = () => {
    const blob = new Blob([artifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "architecture"} — Architecture.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        <Link href={`/projects/${id}`} className="hover:opacity-80 flex items-center gap-1.5 transition-opacity">
          <ArrowLeft className="w-3.5 h-3.5" />
          {project?.name ?? "Project"}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
        <span style={{ color: "var(--text-primary)" }}>Architecture</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Technical Architecture</h1>
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
          <button
            onClick={() => generateArch.mutate({ projectId: id })}
            disabled={generateArch.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--surface-border)",
              background: "var(--surface-card)",
            }}
          >
            {generateArch.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate
          </button>
          <button
            onClick={exportMd}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--surface-border)",
              background: "var(--surface-card)",
            }}
          >
            <Download className="w-3.5 h-3.5" /> Export .md
          </button>
          <Link
            href={`/projects/${id}/generate`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Terminal className="w-3.5 h-3.5" />
            Generate Code <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div
        className="rounded-xl p-8 md:p-12"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div
          className="prose-nexoflow"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(artifact.content) }}
        />
      </div>
    </div>
  );
}
