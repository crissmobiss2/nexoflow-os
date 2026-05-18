"use client";

import { use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  ArrowLeft, FileText, Code2, Loader2,
  CheckCircle2, Circle, ArrowRight, Zap,
} from "lucide-react";
import { formatScore, formatProjectType, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SCORE_DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: "marketSize", label: "Market Size" },
  { key: "problemClarity", label: "Problem Clarity" },
  { key: "competitiveGap", label: "Competitive Gap" },
  { key: "revenueModel", label: "Revenue Model" },
  { key: "teamFit", label: "Team Fit" },
  { key: "timeToValue", label: "Time to Value" },
  { key: "strategicAlignment", label: "Strategic Alignment" },
];

const DECISION_STYLES: Record<string, string> = {
  prioritise: "bg-green-50 text-green-700 border-green-200",
  build: "bg-blue-50 text-blue-700 border-blue-200",
  conditional: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pass: "bg-red-50 text-red-700 border-red-200",
};

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project, refetch, isLoading } = api.projects.get.useQuery({ id });
  const generateScope = api.projects.generateScope.useMutation({ onSuccess: () => void refetch() });
  const generateArch = api.projects.generateArchitecture.useMutation({ onSuccess: () => void refetch() });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-[var(--text-secondary)]">Project not found.</p>
        <Link href="/projects" className="text-[var(--brand-primary)] text-sm hover:underline mt-2 inline-block">← Back</Link>
      </div>
    );
  }

  const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
  const scopeArtifact = project.artifacts.find((a) => a.artifactType === "scope_doc");
  const archArtifact = project.artifacts.find((a) => a.artifactType === "architecture");
  const codeArtifact = project.artifacts.find((a) => a.artifactType === "code_bundle");
  const decisionStyle = project.scoreDecision ? DECISION_STYLES[project.scoreDecision] : "";

  const steps = [
    {
      label: "Scope Document",
      description: "Client-ready scope + pricing",
      icon: <FileText className="w-4 h-4" />,
      done: !!scopeArtifact,
      href: scopeArtifact ? `/projects/${id}/scope` : undefined,
      action: () => generateScope.mutate({ projectId: id }),
      loading: generateScope.isPending,
      disabled: false,
    },
    {
      label: "Architecture",
      description: "System design + tech stack",
      icon: <Code2 className="w-4 h-4" />,
      done: !!archArtifact,
      href: archArtifact ? `/projects/${id}/architecture` : undefined,
      action: () => generateArch.mutate({ projectId: id }),
      loading: generateArch.isPending,
      disabled: !scopeArtifact,
    },
    {
      label: "Generate Code",
      description: "Production-ready boilerplate",
      icon: <Zap className="w-4 h-4" />,
      done: !!codeArtifact,
      href: `/projects/${id}/generate`,
      action: undefined,
      loading: false,
      disabled: !archArtifact,
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/projects"
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{project.name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {formatProjectType(project.projectType)}
            {project.industry ? ` · ${project.industry}` : ""}
            {" · "}Created {formatDate(project.createdAt)}
          </p>
        </div>
        {scoreInfo && project.scoreDecision && (
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold", decisionStyle)}>
            <span className="text-xl font-bold">{project.opportunityScore}</span>
            <span className="text-xs opacity-70">/70</span>
            <span className="capitalize">{project.scoreDecision}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Score breakdown */}
          {project.score && (
            <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
              <h2 className="font-semibold text-sm text-[var(--text-primary)] mb-4">Opportunity Score</h2>
              <div className="space-y-2.5">
                {SCORE_DIMENSIONS.map(({ key, label }) => {
                  const scoreObj = project.score as unknown as Record<string, unknown>;
                  const val = typeof scoreObj[key] === "number" ? (scoreObj[key] as number) : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">{label}</span>
                        <span className="font-semibold text-[var(--text-primary)]">{val}/10</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${val * 10}%`,
                            background: val >= 7 ? "var(--status-success)" : val >= 5 ? "var(--brand-primary)" : "var(--status-warning)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {project.score.aiRationale && (
                <p className="text-xs text-[var(--text-secondary)] mt-4 pt-4 border-t border-[var(--surface-border)] leading-relaxed">
                  {project.score.aiRationale}
                </p>
              )}
            </div>
          )}

          {/* Build phases */}
          <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
            <h2 className="font-semibold text-sm text-[var(--text-primary)] mb-4">Build Phases</h2>
            <div className="space-y-2.5">
              {[...project.phases]
                .sort((a, b) => a.phaseOrder - b.phaseOrder)
                .map((phase) => (
                  <div key={phase.id} className="flex items-center gap-3">
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--surface-border)] shrink-0" />
                    )}
                    <span className={cn("text-sm", phase.status === "completed" ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]")}>
                      {phase.phaseName}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-5">
          {/* AI generation steps */}
          <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
            <h2 className="font-semibold text-sm text-[var(--text-primary)] mb-4">Build Pipeline</h2>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <BuildStep key={i} {...step} />
              ))}
            </div>
          </div>

          {/* Brief */}
          {project.brief && (
            <div className="bg-white rounded-xl border border-[var(--surface-border)] p-5">
              <h2 className="font-semibold text-sm text-[var(--text-primary)] mb-4">Client Brief</h2>
              <dl className="space-y-3">
                {[
                  ["Target User", project.brief.targetUser],
                  ["Job To Be Done", project.brief.coreJobToBeDone],
                  ["Existing Tech", project.brief.existingTech],
                  ["Integrations", project.brief.keyIntegrations],
                  ["Constraints", project.brief.constraints],
                  ["Context", project.brief.additionalContext],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</dt>
                      <dd className="text-sm text-[var(--text-primary)] leading-relaxed">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BuildStep({
  label, description, icon, done, href, action, loading, disabled,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  done: boolean;
  href?: string;
  action?: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-all",
        done
          ? "border-green-200 bg-green-50 cursor-pointer hover:bg-green-100"
          : disabled
          ? "border-[var(--surface-border)] bg-[var(--surface-bg)] opacity-50"
          : "border-[var(--surface-border)] hover:border-[var(--brand-primary)] hover:bg-[hsl(220,90%,56%,0.03)] cursor-pointer",
      )}
      onClick={!disabled && !done && !loading && action ? action : undefined}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", done ? "bg-green-100 text-green-600" : "bg-[hsl(220,90%,56%,0.08)] text-[var(--brand-primary)]")}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {loading ? "Generating..." : label}
        </div>
        <div className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</div>
      </div>
      {(done || !disabled) && !loading && (
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
      )}
    </div>
  );

  if ((done || !disabled) && href) {
    return <Link href={href as string}>{inner}</Link>;
  }
  return inner;
}
