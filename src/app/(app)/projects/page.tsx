import Link from "next/link";
import { api } from "@/lib/trpc/server";
import { formatScore, formatProjectType, formatDate } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  brief: { label: "Brief", color: "bg-gray-100 text-gray-600" },
  scored: { label: "Scored", color: "bg-blue-50 text-blue-700" },
  scoped: { label: "Scoped", color: "bg-purple-50 text-purple-700" },
  architected: { label: "Architected", color: "bg-indigo-50 text-indigo-700" },
  generating: { label: "Generating", color: "bg-yellow-50 text-yellow-700" },
  ready: { label: "Ready", color: "bg-green-50 text-green-700" },
  archived: { label: "Archived", color: "bg-gray-50 text-gray-500" },
};

export default async function ProjectsPage() {
  const projects = await api.projects.list();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Projects</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--surface-border)] flex flex-col items-center justify-center py-20">
          <p className="font-medium text-[var(--text-primary)] mb-2">No projects yet</p>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Submit your first client brief
          </p>
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            New Project
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--surface-border)] divide-y divide-[var(--surface-border)]">
          {projects.map((project) => {
            const scoreInfo = project.opportunityScore
              ? formatScore(project.opportunityScore)
              : null;
            const statusStyle = STATUS_LABELS[project.status] ?? STATUS_LABELS.brief;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[var(--surface-bg)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-[var(--text-primary)] text-sm">
                      {project.name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {formatProjectType(project.projectType)}
                      {project.industry ? ` · ${project.industry}` : ""}
                      {project.client?.company ? ` · ${project.client.company}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle.color}`}
                  >
                    {statusStyle.label}
                  </span>
                  {scoreInfo && (
                    <span className={`text-sm font-semibold ${scoreInfo.color}`}>
                      {project.opportunityScore}/70
                    </span>
                  )}
                  <span className="text-xs text-[var(--text-muted)] w-24 text-right">
                    {formatDate(project.createdAt)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
