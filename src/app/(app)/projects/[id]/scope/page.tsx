"use client";

import { use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

export default function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: artifact, isLoading } = api.projects.getArtifact.useQuery({
    projectId: id,
    artifactType: "scope_doc",
  });
  const { data: project } = api.projects.get.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-[var(--text-secondary)]">No scope document found.</p>
        <Link href={`/projects/${id}`} className="text-[var(--brand-primary)] text-sm hover:underline mt-2 inline-block">
          ← Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/projects/${id}`}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-4 h-4" />
          {project?.name ?? "Back"}
        </Link>
        <button
          onClick={() => {
            const blob = new Blob([artifact.content], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${project?.name ?? "scope"}-scope.md`;
            a.click();
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-bg)] transition-colors"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[var(--surface-border)] p-8">
        <div
          className="prose-nexoflow"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(artifact.content) }}
        />
      </div>

      {artifact.promptTokens && (
        <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
          Generated with {artifact.modelUsed} ·{" "}
          {((artifact.promptTokens + (artifact.completionTokens ?? 0)) / 1000).toFixed(1)}K tokens
        </p>
      )}
    </div>
  );
}

// Minimal markdown → HTML converter (replace with a proper lib like marked in production)
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "<p>")
    .replace(/(?<![>])$/gm, "</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<[hul])/g, "$1")
    .replace(/(<\/[hul][^>]*>)<\/p>/g, "$1");
}
