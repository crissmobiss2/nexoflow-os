export const revalidate = 30;

import Link from "next/link";
import { db } from "@/server/db";
import { desc } from "drizzle-orm";
import { projects } from "@/server/db/schema";
import { formatScore, formatProjectType, formatDate } from "@/lib/utils";
import { Plus, ArrowRight, FolderKanban, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  brief: { label: "Brief", color: "text-slate-400", dot: "bg-slate-500" },
  scored: { label: "Scored", color: "text-sky-400", dot: "bg-sky-400" },
  scoped: { label: "Scoped", color: "text-violet-400", dot: "bg-violet-400" },
  architected: { label: "Architected", color: "text-indigo-400", dot: "bg-indigo-400" },
  generating: { label: "Generating", color: "text-amber-400", dot: "bg-amber-400" },
  ready: { label: "Ready", color: "text-emerald-400", dot: "bg-emerald-400" },
  archived: { label: "Archived", color: "text-slate-600", dot: "bg-slate-600" },
};

export default async function ProjectsPage() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [desc(projects.createdAt)],
    with: { client: true, score: true },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Projects</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {allProjects.length} project{allProjects.length !== 1 ? "s" : ""} in pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/projects/board"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--surface-border)",
              background: "var(--surface-elevated)",
            }}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Board View
          </Link>
          <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-3.5 h-3.5" /> New Project
        </Link>
      </div>
    </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        {allProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(220 90% 62% / 0.1)" }}
            >
              <FolderKanban className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              No projects yet
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>
              Submit your first client brief
            </p>
            <Link
              href="/projects/new"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              New Project
            </Link>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className="grid items-center px-6 py-3"
              style={{
                borderBottom: "1px solid var(--surface-border)",
                gridTemplateColumns: "1fr 130px 80px 100px 24px",
                gap: "1rem",
              }}
            >
              {["Project", "Status", "Score", "Created", ""].map((h) => (
                <div key={h} className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {h}
                </div>
              ))}
            </div>

            {allProjects.map((project) => {
              const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
              const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.brief!;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="grid items-center px-6 py-3.5 transition-colors group hover:bg-[var(--surface-card-hover)]"
                  style={{
                    borderBottom: "1px solid var(--surface-border-subtle)",
                    gridTemplateColumns: "1fr 130px 80px 100px 24px",
                    gap: "1rem",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {project.name}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {formatProjectType(project.projectType)}
                      {project.industry ? ` · ${project.industry}` : ""}
                      {project.client?.company ? ` · ${project.client.company}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot)} />
                    <span className={cn("text-xs font-medium", status.color)}>{status.label}</span>
                  </div>

                  <div>
                    {scoreInfo ? (
                      <span className={cn("text-sm font-semibold tabular-nums", scoreInfo.color)}>
                        {project.opportunityScore}/70
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>

                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(project.createdAt)}
                  </div>

                  <ArrowRight
                    className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--text-muted)" }}
                  />
                </Link>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
