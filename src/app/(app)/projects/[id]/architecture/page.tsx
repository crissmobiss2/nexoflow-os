"use client";

import { use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, RefreshCw, ArrowRight } from "lucide-react";
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
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <p className="text-[var(--text-secondary)] mb-4">No architecture document found.</p>
        <Link href={`/projects/${id}`} className="text-[var(--brand-primary)] text-sm hover:underline">
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
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/projects/${id}`}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-4 h-4" />
          {project?.name ?? "Back"}
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => generateArch.mutate({ projectId: id })}
            disabled={generateArch.isPending}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-bg)] disabled:opacity-50 transition-colors"
          >
            {generateArch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerate
          </button>
          <button
            onClick={exportMd}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-bg)] transition-colors"
          >
            <Download className="w-4 h-4" /> Export .md
          </button>
          <Link
            href={`/projects/${id}/generate`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            Generate Code <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--surface-border)] p-8 md:p-12">
        <div
          className="prose-nexoflow"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(artifact.content) }}
        />
      </div>
    </div>
  );
}
