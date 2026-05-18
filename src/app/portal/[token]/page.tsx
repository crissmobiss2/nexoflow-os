import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { renderMarkdown } from "@/lib/markdown";
import { CheckCircle2, Circle, ArrowLeft, FileText, Users } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalPage({ params }: PageProps) {
  const { token } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.portalToken, token),
    with: { client: true, brief: true, artifacts: true, phases: true },
  });

  if (!project || !project.portalEnabled) {
    notFound();
  }

  const scopeArtifact = project.artifacts.find(
    (a) => a.artifactType === "scope_doc"
  );
  const sortedPhases = [...project.phases].sort(
    (a, b) => a.phaseOrder - b.phaseOrder
  );
  const completedPhases = sortedPhases.filter(
    (p) => p.status === "completed"
  ).length;
  const totalPhases = sortedPhases.length;
  const progressPct = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  const statusColor: Record<string, string> = {
    brief: "hsl(38, 92%, 58%)",
    scored: "hsl(207, 90%, 62%)",
    scoped: "hsl(220, 90%, 62%)",
    architected: "hsl(262, 83%, 68%)",
    generating: "hsl(38, 92%, 58%)",
    ready: "hsl(142, 68%, 52%)",
    archived: "hsl(0, 0%, 45%)",
  };

  const statusLabel: Record<string, string> = {
    brief: "Briefing",
    scored: "Scored",
    scoped: "Scope Defined",
    architected: "Architected",
    generating: "Generating",
    ready: "Ready",
    archived: "Archived",
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Back / branding */}
      <div className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to project
        </Link>
        <span
          className="text-[11px] font-medium tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Client Portal
        </span>
      </div>

      {/* Hero */}
      <div className="mb-10">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {project.name}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: `${statusColor[project.status] ?? "hsl(220, 12%, 60%)"}15`,
              color: statusColor[project.status] ?? "var(--text-secondary)",
              border: `1px solid ${statusColor[project.status] ?? "hsl(220, 12%, 60%)"}30`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: statusColor[project.status] ?? "var(--text-secondary)" }}
            />
            {statusLabel[project.status] ?? project.status}
          </span>

          {project.client && (
            <span
              className="inline-flex items-center gap-1.5 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <Users className="w-3 h-3" />
              {project.client.name}
              {project.client.company ? ` — ${project.client.company}` : ""}
            </span>
          )}

          {project.timelineWeeks && (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {project.timelineWeeks} week{project.timelineWeeks !== 1 ? "s" : ""} estimated
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column: brief + scope */}
        <div className="md:col-span-2 space-y-8">
          {/* Client Brief Summary */}
          {project.brief && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                Project Brief
              </h2>
              <div
                className="rounded-xl p-5 space-y-4"
                style={{
                  background: "hsl(222, 25%, 8%)",
                  border: "1px solid hsl(222, 22%, 14%)",
                }}
              >
                {[
                  ["Target User", project.brief.targetUser],
                  ["Core Job To Be Done", project.brief.coreJobToBeDone],
                  ["Existing Tech", project.brief.existingTech],
                  ["Key Integrations", project.brief.keyIntegrations],
                  ["Constraints", project.brief.constraints],
                  ["Additional Context", project.brief.additionalContext],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label as string}>
                      <dt
                        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {label}
                      </dt>
                      <dd
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Scope Document */}
          {scopeArtifact && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2"
                style={{ color: "var(--text-muted)" }}
              >
                <FileText className="w-3.5 h-3.5" />
                Scope Document
              </h2>
              <div
                className="rounded-xl p-6"
                style={{
                  background: "hsl(222, 25%, 8%)",
                  border: "1px solid hsl(222, 22%, 14%)",
                }}
              >
                <div
                  className="prose-nexoflow"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(scopeArtifact.content),
                  }}
                />
              </div>
            </section>
          )}
        </div>

        {/* Right column: timeline + milestones */}
        <div className="space-y-8">
          {/* Milestone Progress */}
          <section>
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Milestone Progress
            </h2>
            <div
              className="rounded-xl p-5"
              style={{
                background: "hsl(222, 25%, 8%)",
                border: "1px solid hsl(222, 22%, 14%)",
              }}
            >
              {/* Progress ring */}
              <div className="flex items-center justify-center mb-5">
                <div
                  className="relative w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(var(--status-success) ${progressPct}%, hsl(222, 22%, 14%) ${progressPct}%)`,
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: "hsl(222, 25%, 8%)" }}
                  >
                    <span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {progressPct}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {sortedPhases.map((phase) => (
                  <div key={phase.id} className="flex items-center gap-2.5">
                    {phase.status === "completed" ? (
                      <CheckCircle2
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: "var(--status-success)" }}
                      />
                    ) : (
                      <Circle
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: "hsl(222, 22%, 20%)" }}
                      />
                    )}
                    <span
                      className="text-xs"
                      style={{
                        color:
                          phase.status === "completed"
                            ? "var(--text-secondary)"
                            : "var(--text-muted)",
                      }}
                    >
                      {phase.phaseName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Timeline Summary */}
          {project.timelineWeeks && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                Timeline
              </h2>
              <div
                className="rounded-xl p-5"
                style={{
                  background: "hsl(222, 25%, 8%)",
                  border: "1px solid hsl(222, 22%, 14%)",
                }}
              >
                <div className="space-y-4">
                  {sortedPhases.map((phase, i) => (
                    <div key={phase.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                          style={{
                            background:
                              phase.status === "completed"
                                ? "var(--status-success)"
                                : "hsl(222, 22%, 18%)",
                          }}
                        />
                        {i < sortedPhases.length - 1 && (
                          <div
                            className="w-px flex-1 min-h-[20px]"
                            style={{
                              background:
                                phase.status === "completed"
                                  ? "var(--status-success)"
                                  : "hsl(222, 22%, 14%)",
                            }}
                          />
                        )}
                      </div>
                      <div className="pb-3">
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {phase.phaseName}
                        </p>
                        <p
                          className="text-[11px] mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {phase.status === "completed"
                            ? "Completed"
                            : phase.status === "in_progress"
                              ? "In Progress"
                              : "Pending"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer
        className="mt-16 pt-6 border-t text-center"
        style={{ borderColor: "hsl(222, 22%, 12%)" }}
      >
        <p
          className="text-[11px] tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Powered by <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>NexoFlow</span> &mdash; Build Intelligence System
        </p>
      </footer>
    </div>
  );
}
