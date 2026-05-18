export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/server/db";
import { desc } from "drizzle-orm";
import { projects } from "@/server/db/schema";
import { formatScore, formatProjectType, formatDate } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, string> = {
  brief: "bg-gray-100 text-gray-600",
  scored: "bg-blue-50 text-blue-700",
  scoped: "bg-purple-50 text-purple-700",
  architected: "bg-indigo-50 text-indigo-700",
  generating: "bg-yellow-50 text-yellow-700",
  ready: "bg-green-50 text-green-700",
  archived: "bg-gray-50 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  brief: "Brief", scored: "Scored", scoped: "Scoped",
  architected: "Architected", generating: "Generating", ready: "Ready", archived: "Archived",
};

export default async function ProjectsPage() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [desc(projects.createdAt)],
    with: { client: true, score: true },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Projects</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {allProjects.length} project{allProjects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--surface-border)]">
        {allProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-medium text-[var(--text-primary)] mb-2">No projects yet</p>
            <p className="text-sm text-[var(--text-secondary)] mb-6">Submit your first client brief</p>
            <Link href="/projects/new" className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors">
              New Project
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border)]">
            {allProjects.map((project) => {
              const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
              const badge = STATUS_BADGES[project.status] ?? STATUS_BADGES.brief;
              const label = STATUS_LABELS[project.status] ?? project.status;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-[var(--surface-bg)] transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm text-[var(--text-primary)]">{project.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {formatProjectType(project.projectType)}
                      {project.industry ? ` · ${project.industry}` : ""}
                      {project.client?.company ? ` · ${project.client.company}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", badge)}>
                      {label}
                    </span>
                    {scoreInfo && (
                      <span className={cn("text-sm font-semibold", scoreInfo.color)}>
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
    </div>
  );
}
