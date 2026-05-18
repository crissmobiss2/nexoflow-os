export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/server/db";
import { desc } from "drizzle-orm";
import { projects } from "@/server/db/schema";
import { formatScore, formatProjectType, formatRelativeTime } from "@/lib/utils";
import { Plus, ArrowRight, Zap, TrendingUp, FolderKanban, Star } from "lucide-react";

export default async function DashboardPage() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [desc(projects.createdAt)],
    with: { client: true, score: true },
  });

  const active = allProjects.filter((p) => p.status !== "archived");
  const prioritised = allProjects.filter((p) => p.scoreDecision === "prioritise");
  const ready = allProjects.filter((p) => p.status === "ready");
  const scored = allProjects.filter((p) => p.opportunityScore !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + (p.opportunityScore ?? 0), 0) / scored.length)
      : null;

  const stats = [
    { label: "Active Projects", value: active.length, icon: FolderKanban, color: "var(--brand-primary)", bg: "hsl(220 90% 62% / 0.1)" },
    { label: "Prioritised", value: prioritised.length, icon: Star, color: "hsl(142, 68%, 52%)", bg: "hsl(142 68% 52% / 0.1)" },
    { label: "Code Ready", value: ready.length, icon: Zap, color: "hsl(262, 83%, 68%)", bg: "hsl(262 83% 68% / 0.1)" },
    { label: "Avg Score", value: avgScore !== null ? `${avgScore}/70` : "—", icon: TrendingUp, color: "hsl(38, 92%, 58%)", bg: "hsl(38 92% 58% / 0.1)" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1.5 h-5 rounded-full"
              style={{ background: "var(--brand-gradient)" }}
            />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Dashboard
            </h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            NexoFlow build intelligence system
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-3.5 h-3.5" /> New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--surface-border)",
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <div className="text-2xl font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>
              {value}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Projects
          </h2>
          <Link
            href="/projects"
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--brand-primary)" }}
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {allProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(220 90% 62% / 0.1)" }}
            >
              <Zap className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              No projects yet
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>
              Submit your first client brief to get started
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
          <div>
            {allProjects.slice(0, 8).map((project) => {
              const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-6 py-3.5 transition-colors group"
                  style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-card-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {project.name}
                      </div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {formatProjectType(project.projectType)}
                        {project.industry ? ` · ${project.industry}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 ml-4">
                    {scoreInfo && (
                      <span className={`text-sm font-semibold ${scoreInfo.color}`}>
                        {project.opportunityScore}/70
                      </span>
                    )}
                    <span className="text-xs w-16 text-right" style={{ color: "var(--text-muted)" }}>
                      {formatRelativeTime(project.createdAt)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
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
