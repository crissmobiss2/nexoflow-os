"use client";

import { use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

export default function ArchitecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: artifact, isLoading } = api.projects.getArtifact.useQuery({
    projectId: id,
    artifactType: "architecture",
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
        <p className="text-[var(--text-secondary)]">No architecture document found.</p>
        <Link href={`/projects/${id}`} className="text-[var(--brand-primary)] text-sm hover:underline mt-2 inline-block">
          ← Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/projects/${id}`}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-4 h-4" />
          {project?.name ?? "Back"}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}/generate`}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            Generate Code →
          </Link>
          <button
            onClick={() => {
              const blob = new Blob([artifact.content], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${project?.name ?? "architecture"}-architecture.md`;
              a.click();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-bg)] transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--surface-border)] p-8">
        <div
          className="prose-nexoflow"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(artifact.content) }}
        />
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/^(?!<)/gm, "");
}
