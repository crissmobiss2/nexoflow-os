"use client";

import { use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, Zap, FileText, Code2, Loader2, CheckCircle2, Circle } from "lucide-react";
import { formatScore, formatProjectType, formatDate } from "@/lib/utils";

const SCORE_LABELS: Record<string, string> = {
  marketSize: "Market Size",
  problemClarity: "Problem Clarity",
  competitiveGap: "Competitive Gap",
  revenueModel: "Revenue Model",
  teamFit: "Team Fit",
  timeToValue: "Time to Value",
  strategicAlignment: "Strategic Alignment",
};

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project, refetch } = api.projects.get.useQuery({ id });
  const generateScope = api.projects.generateScope.useMutation({ onSuccess: () => refetch() });
  const generateArch = api.projects.generateArchitecture.useMutation({ onSuccess: () => refetch() });

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
  const scopeArtifact = project.artifacts.find((a) => a.artifactType === "scope_doc");
  const archArtifact = project.artifacts.find((a) => a.artifactType === "architecture");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/projects"
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{project.name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {formatProjectType(project.projectType)}
            {project.industry ? ` · ${project.industry}` : ""}
            {project.createdAt ? ` · Created ${formatDate(project.createdAt)}` : ""}
          </p>
        </div>
        {scoreInfo && (
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreInfo.color}`}>
              {project.opportunityScore}/70
            </div>
            <div className={`text-sm font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Score + Phases */}
        <div className="space-y-5">
          {/* Score breakdown */}
          {project.score && (
            <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
              <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-4">
                Opportunity Score
              </h2>
              <div className="space-y-2.5">
                {Object.entries(SCORE_LABELS).map(([key, label]) => {
                  const val = (project.score as Record<string, number>)[key] ?? 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">{label}</span>
                        <span className="font-semibold text-[var(--text-primary)]">{val}/10</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand-primary)] rounded-full"
                          style={{ width: `${val * 10}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {project.score.aiRationale && (
                <p className="text-xs text-[var(--text-secondary)] mt-4 pt-4 border-t border-[var(--surface-border)]">
                  {project.score.aiRationale}
                </p>
              )}
            </div>
          )}

          {/* Build phases */}
          <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
            <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-4">Build Phases</h2>
            <div className="space-y-3">
              {project.phases
                .sort((a, b) => a.phaseOrder - b.phaseOrder)
                .map((phase) => (
                  <div key={phase.id} className="flex items-center gap-3">
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" />
                    ) : phase.status === "in_progress" ? (
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--brand-primary)] shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--surface-border)] shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        phase.status === "completed"
                          ? "text-[var(--text-secondary)] line-through"
                          : phase.status === "in_progress"
                            ? "text-[var(--text-primary)] font-medium"
                            : "text-[var(--text-muted)]"
                      }`}
                    >
                      {phase.phaseName}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Actions + Artifacts */}
        <div className="col-span-2 space-y-5">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
            <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-4">
              AI Generation
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                icon={<FileText className="w-4 h-4" />}
                label="Generate Scope"
                description="Scope doc ready to send to client"
                onClick={() => generateScope.mutate({ projectId: id })}
                loading={generateScope.isPending}
                done={!!scopeArtifact}
                href={scopeArtifact ? `/projects/${id}/scope` : undefined}
              />
              <ActionButton
                icon={<Code2 className="w-4 h-4" />}
                label="Architecture"
                description="System design + tech stack"
                onClick={() => generateArch.mutate({ projectId: id })}
                loading={generateArch.isPending}
                done={!!archArtifact}
                disabled={!scopeArtifact}
                href={archArtifact ? `/projects/${id}/architecture` : undefined}
              />
            </div>
          </div>

          {/* Brief summary */}
          {project.brief && (
            <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
              <h2 className="font-semibold text-[var(--text-primary)] text-sm mb-4">
                Client Brief
              </h2>
              <dl className="space-y-3">
                {[
                  ["Target User", project.brief.targetUser],
                  ["Job To Be Done", project.brief.coreJobToBeDone],
                  ["Existing Tech", project.brief.existingTech],
                  ["Integrations", project.brief.keyIntegrations],
                  ["Constraints", project.brief.constraints],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label as string}>
                      <dt className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
                        {label}
                      </dt>
                      <dd className="text-sm text-[var(--text-primary)]">{value}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
  loading,
  done,
  disabled,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  loading: boolean;
  done: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`p-4 rounded-lg border transition-colors text-left w-full ${
        done
          ? "border-[var(--status-success)] bg-[hsl(142,71%,45%,0.05)] cursor-pointer hover:bg-[hsl(142,71%,45%,0.1)]"
          : disabled
            ? "border-[var(--surface-border)] bg-[var(--surface-bg)] opacity-50 cursor-not-allowed"
            : "border-[var(--surface-border)] hover:border-[var(--brand-primary)] hover:bg-[hsl(220,90%,56%,0.04)] cursor-pointer"
      }`}
      onClick={!disabled && !loading && !done ? onClick : undefined}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={done ? "text-[var(--status-success)]" : "text-[var(--brand-primary)]"}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {loading ? "Generating..." : done ? `${label} ✓` : label}
        </span>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{description}</p>
    </div>
  );

  if (done && href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
