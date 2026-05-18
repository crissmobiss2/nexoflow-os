export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/server/db";
import { desc } from "drizzle-orm";
import { projects } from "@/server/db/schema";
import { formatScore, formatProjectType, formatRelativeTime } from "@/lib/utils";
import { Plus, ArrowRight, Zap } from "lucide-react";

export default async function DashboardPage() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [desc(projects.createdAt)],
    with: { client: true, score: true },
  });

  const active = allProjects.filter((p) => p.status !== "archived");
  const prioritised = allProjects.filter((p) => p.scoreDecision === "prioritise");
  const scored = allProjects.filter((p) => p.opportunityScore !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, p) => s + (p.opportunityScore ?? 0), 0) / scored.length,
        )
      : null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">NexoFlow build intelligence system</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Projects", value: active.length },
          { label: "Prioritised", value: prioritised.length },
          { label: "Total Projects", value: allProjects.length },
          { label: "Avg Score", value: avgScore !== null ? `${avgScore}/70` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div className="bg-white rounded-xl border border-[var(--surface-border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--surface-border)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Recent Projects</h2>
          <Link href="/projects" className="flex items-center gap-1 text-sm text-[var(--brand-primary)] hover:underline">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {allProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[hsl(220,90%,56%,0.08)] flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-[var(--brand-primary)]" />
            </div>
            <p className="font-medium text-[var(--text-primary)]">No projects yet</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">Submit a client brief to get started</p>
            <Link href="/projects/new" className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors">
              New Project
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border)]">
            {allProjects.slice(0, 8).map((project) => {
              const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
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
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    {scoreInfo && (
                      <span className={`font-semibold ${scoreInfo.color}`}>
                        {project.opportunityScore}/70 · {scoreInfo.label}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(project.createdAt)}</span>
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
