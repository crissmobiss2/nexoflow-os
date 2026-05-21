"use client";

import { use, useState, useEffect } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  ArrowLeft, FileText, Code2, Loader2,
  CheckCircle2, Circle, ArrowRight, Zap, Terminal, FileSignature,
  Eye, Globe, Copy, MessageSquare, Send, FileSearch, DollarSign,
} from "lucide-react";
import { formatScore, formatProjectType, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SCORE_DIMENSIONS = [
  { key: "marketSize", label: "Market Size" },
  { key: "problemClarity", label: "Problem Clarity" },
  { key: "competitiveGap", label: "Competitive Gap" },
  { key: "revenueModel", label: "Revenue Model" },
  { key: "teamFit", label: "Team Fit" },
  { key: "timeToValue", label: "Time to Value" },
  { key: "strategicAlignment", label: "Strategic Alignment" },
];

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project, refetch, isLoading } = api.projects.get.useQuery({ id });
  const generateScope = api.projects.generateScope.useMutation({ onSuccess: () => void refetch() });
  const generateArch = api.projects.generateArchitecture.useMutation({ onSuccess: () => void refetch() });
  const enablePortal = api.projects.enablePortal.useMutation({ onSuccess: () => void refetch() });
  const disablePortal = api.projects.disablePortal.useMutation({ onSuccess: () => void refetch() });
  const [newComment, setNewComment] = useState("");
  const addComment = api.comments.create.useMutation({ onSuccess: () => { void refetch(); setNewComment(""); } });
  const [budgetInput, setBudgetInput] = useState("");
  const [invoiceCreated, setInvoiceCreated] = useState<number | null>(null);
  const createMilestoneInvoice = api.invoices.createMilestoneInvoice.useMutation({
    onSuccess: (inv, vars) => setInvoiceCreated(vars.milestoneStep as unknown as number),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Project not found.</p>
        <Link href="/projects" className="text-sm mt-2 inline-block hover:underline" style={{ color: "var(--brand-primary)" }}>
          ← Back to projects
        </Link>
      </div>
    );
  }

  const scoreInfo = project.opportunityScore ? formatScore(project.opportunityScore) : null;
  const scopeArtifact = project.artifacts.find((a) => a.artifactType === "scope_doc");
  const archArtifact = project.artifacts.find((a) => a.artifactType === "architecture");
  const codeArtifact = project.artifacts.find((a) => a.artifactType === "code_bundle");

  const steps = [
    {
      label: "Scope Document",
      description: "Client-ready scope with deliverables, timeline & pricing",
      icon: <FileText className="w-4 h-4" />,
      done: !!scopeArtifact,
      href: scopeArtifact ? `/projects/${id}/scope` : undefined,
      action: () => generateScope.mutate({ projectId: id }),
      loading: generateScope.isPending,
      disabled: false,
      step: "01",
    },
    {
      label: "Architecture",
      description: "Full system design, stack, DB schema & infrastructure",
      icon: <Code2 className="w-4 h-4" />,
      done: !!archArtifact,
      href: archArtifact ? `/projects/${id}/architecture` : undefined,
      action: () => generateArch.mutate({ projectId: id }),
      loading: generateArch.isPending,
      disabled: !scopeArtifact,
      step: "02",
    },
    {
      label: "Generate Code",
      description: "Production-ready boilerplate from NexoFlow engineering standards",
      icon: <Terminal className="w-4 h-4" />,
      done: !!codeArtifact,
      href: `/projects/${id}/generate`,
      action: undefined,
      loading: false,
      disabled: !archArtifact,
      step: "03",
    },
    {
      label: "Proposal",
      description: "Client-ready proposal with scope, timeline & pricing",
      icon: <FileSignature className="w-4 h-4" />,
      done: false,
      href: `/projects/${id}/proposal`,
      action: undefined,
      loading: false,
      disabled: !scopeArtifact,
      step: "04",
    },
    {
      label: "Sprint",
      description: "Break scope into tasks with kanban planning",
      icon: <CheckCircle2 className="w-4 h-4" />,
      done: false,
      href: `/projects/${id}/sprint`,
      action: undefined,
      loading: false,
      disabled: !scopeArtifact,
      step: "05",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/projects"
        className="flex items-center gap-1.5 text-sm mb-6 w-fit transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {project.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {formatProjectType(project.projectType)}
            {project.industry ? ` · ${project.industry}` : ""}
            {" · "}Created {formatDate(project.createdAt)}
          </p>
        </div>

        {scoreInfo && project.scoreDecision && (
          <div
            className={cn("flex items-baseline gap-2 px-4 py-2.5 rounded-xl border", scoreInfo.bgColor, scoreInfo.borderColor)}
          >
            <span className={cn("text-2xl font-bold tabular-nums", scoreInfo.color)}>
              {project.opportunityScore}
            </span>
            <span className="text-xs opacity-60" style={{ color: "inherit" }}>/70</span>
            <span className={cn("text-sm font-semibold capitalize ml-1", scoreInfo.color)}>
              {project.scoreDecision}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">

          {/* Score breakdown */}
          {project.score && (
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Opportunity Score
              </h2>
              <div className="space-y-3">
                {SCORE_DIMENSIONS.map(({ key, label }) => {
                  const scoreObj = project.score as unknown as Record<string, unknown>;
                  const val = typeof scoreObj[key] === "number" ? (scoreObj[key] as number) : 0;
                  const barColor = val >= 7 ? "var(--status-success)" : val >= 5 ? "var(--brand-primary)" : "var(--status-warning)";
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                        <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{val}/10</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-border)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${val * 10}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {project.score.aiRationale && (
                <p
                  className="text-xs mt-4 pt-4 leading-relaxed"
                  style={{
                    color: "var(--text-secondary)",
                    borderTop: "1px solid var(--surface-border)",
                  }}
                >
                  {project.score.aiRationale}
                </p>
              )}
            </div>
          )}

          {/* Build phases */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              Build Phases
            </h2>
            <div className="space-y-2">
              {[...project.phases]
                .sort((a, b) => a.phaseOrder - b.phaseOrder)
                .map((phase) => (
                  <div key={phase.id} className="flex items-center gap-2.5">
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--status-success)" }} />
                    ) : (
                      <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--surface-border)" }} />
                    )}
                    <span
                      className={cn("text-xs", phase.status === "completed" && "line-through opacity-50")}
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {phase.phaseName}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Milestone Payments */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <DollarSign className="w-3.5 h-3.5" />
              Milestone Invoices
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Total Budget ($)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>
              {[
                { step: "1" as const, label: "Kickoff", pct: 30 },
                { step: "2" as const, label: "Midpoint", pct: 40 },
                { step: "3" as const, label: "Delivery", pct: 30 },
              ].map(({ step, label, pct }) => {
                const amt = budgetInput ? Math.round(Number(budgetInput) * pct / 100) : null;
                const isThisOne = createMilestoneInvoice.isPending && invoiceCreated === null;
                return (
                  <button
                    key={step}
                    disabled={!budgetInput || Number(budgetInput) <= 0 || createMilestoneInvoice.isPending}
                    onClick={() => {
                      setInvoiceCreated(null);
                      createMilestoneInvoice.mutate({
                        projectId: id,
                        milestoneStep: step,
                        totalBudgetCents: Math.round(Number(budgetInput) * 100),
                      });
                    }}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-secondary)" }}
                  >
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {label} ({pct}%)
                    </span>
                    <span style={{ color: "hsl(142, 68%, 52%)" }}>
                      {amt !== null ? `$${amt.toLocaleString()}` : "—"}
                    </span>
                  </button>
                );
              })}
              {invoiceCreated !== null && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(142, 68%, 52%)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Invoice created — <Link href="/invoices" className="underline">view invoices</Link>
                </div>
              )}
            </div>
          </div>

          {/* Client Portal */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <Globe className="w-3.5 h-3.5" />
              Client Portal
            </h2>

            {!project.portalEnabled ? (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Enable a read-only client portal so your client can view the scope, timeline, and progress.
                </p>
                <button
                  className="nf-input inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all w-fit"
                  style={{
                    background: "var(--brand-gradient)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    opacity: enablePortal.isPending ? 0.6 : 1,
                  }}
                  disabled={enablePortal.isPending}
                  onClick={() => enablePortal.mutate({ projectId: id })}
                >
                  {enablePortal.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {enablePortal.isPending ? "Enabling..." : "Enable Client Portal"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: "hsl(142, 68%, 52%, 0.12)",
                      color: "var(--status-success)",
                      border: "1px solid hsl(142, 68%, 52%, 0.25)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Active
                  </span>
                </div>

                {project.portalToken && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                      Portal URL
                    </p>
                    <div
                      className="flex items-center gap-2 p-2.5 rounded-lg text-xs break-all"
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--surface-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span className="flex-1 min-w-0 truncate font-mono">
                        nexoflow-os.vercel.app/portal/{project.portalToken}
                      </span>
                      <button
                        className="shrink-0 p-1 rounded transition-colors hover:opacity-70"
                        style={{ color: "var(--text-muted)" }}
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `https://nexoflow-os.vercel.app/portal/${project.portalToken ?? ""}`
                          );
                        }}
                        title="Copy URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className="text-xs font-medium transition-colors hover:opacity-70"
                  style={{ color: "var(--status-error)" }}
                  disabled={disablePortal.isPending}
                  onClick={() => disablePortal.mutate({ projectId: id })}
                >
                  {disablePortal.isPending ? "Disabling..." : "Disable portal"}
                </button>
              </div>
            )}
          </div>

          {/* Related Decisions */}
          <RelatedDecisions projectType={project.projectType} industry={project.industry} />
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-5">
          {/* Build Pipeline */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              Build Pipeline
            </h2>
            <div className="space-y-2.5">
              {steps.map((step, i) => (
                <BuildStep key={i} {...step} />
              ))}
            </div>
          </div>

          {/* Client Brief */}
          {project.brief && (
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Client Brief
              </h2>
              <dl className="space-y-4">
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
                      <dt
                        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {label}
                      </dt>
                      <dd className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          {/* Comments */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <MessageSquare className="w-3.5 h-3.5" />
              Comments ({project.comments?.length ?? 0})
            </h2>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {(project.comments ?? []).length === 0 && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No comments yet. Add one below.</p>
              )}
              {(project.comments ?? []).map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      {comment.authorName}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(comment.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Add comment */}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="nf-input resize-none flex-1 text-sm"
                style={{ background: "var(--surface-elevated)" }}
              />
              <button
                type="button"
                disabled={!newComment.trim() || addComment.isPending}
                onClick={() =>
                  addComment.mutate({
                    projectId: id,
                    authorName: "You",
                    content: newComment,
                  })
                }
                className="self-end p-2.5 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                {addComment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildStep({
  label, description, icon, done, href, action, loading, disabled, step,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  done: boolean;
  href?: string;
  action?: () => void;
  loading: boolean;
  disabled: boolean;
  step: string;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-default",
        done ? "cursor-pointer" : disabled ? "opacity-40" : "cursor-pointer",
      )}
      style={
        done
          ? { borderColor: "hsl(142 68% 52% / 0.3)", background: "hsl(142 68% 52% / 0.07)" }
          : disabled
          ? { borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }
          : { borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }
      }
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          (e.currentTarget as HTMLElement).style.borderColor = done
            ? "hsl(142 68% 52% / 0.5)"
            : "var(--brand-primary)";
          if (!done) (e.currentTarget as HTMLElement).style.background = "hsl(220 90% 62% / 0.06)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = done
          ? "hsl(142 68% 52% / 0.3)"
          : disabled ? "var(--surface-border)" : "var(--surface-border)";
        (e.currentTarget as HTMLElement).style.background = done
          ? "hsl(142 68% 52% / 0.07)"
          : "var(--surface-elevated)";
      }}
      onClick={!disabled && !done && !loading && action ? action : undefined}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
        style={
          done
            ? { background: "hsl(142 68% 52% / 0.15)", color: "var(--status-success)" }
            : { background: "hsl(220 90% 62% / 0.12)", color: "var(--brand-primary)" }
        }
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono opacity-40" style={{ color: "var(--text-muted)" }}>
            {step}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {loading ? "Generating..." : label}
          </span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {description}
        </div>
      </div>
      {!disabled && !loading && (
        <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      )}
    </div>
  );

  if ((done || !disabled) && href) {
    return <Link href={href as string}>{inner}</Link>;
  }
  return inner;
}

// ─── Related Decisions Panel ─────────────────────────────────────────────────

function RelatedDecisions({ projectType, industry }: { projectType: string; industry?: string | null }) {
  const categories = [projectType, industry].filter(Boolean) as string[];
  const { data: decisions, isLoading } = api.decisionLog.byAffected.useQuery(
    { categories, limit: 5 },
    { enabled: categories.length > 0 },
  );

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading related decisions...</span>
        </div>
      </div>
    );
  }

  if (!decisions || decisions.length === 0) return null;

  const statusColor = (status: string) => {
    switch (status) {
      case "accepted": return { bg: "hsl(142, 68%, 52%, 0.12)", color: "var(--status-success)", border: "hsl(142, 68%, 52%, 0.25)" };
      case "proposed": return { bg: "hsl(220, 90%, 62%, 0.12)", color: "var(--brand-primary)", border: "hsl(220, 90%, 62%, 0.25)" };
      case "deprecated": return { bg: "hsl(38, 92%, 50%, 0.12)", color: "var(--status-warning)", border: "hsl(38, 92%, 50%, 0.25)" };
      case "superseded": return { bg: "hsl(0, 84%, 60%, 0.12)", color: "var(--status-error)", border: "hsl(0, 84%, 60%, 0.25)" };
      default: return { bg: "var(--surface-elevated)", color: "var(--text-muted)", border: "var(--surface-border)" };
    }
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
        <FileSearch className="w-3.5 h-3.5" />
        Related Decisions ({decisions.length})
      </h2>
      <div className="space-y-2.5">
        {decisions.map((decl) => {
          const sc = statusColor(decl.status);
          return (
            <div
              key={decl.id}
              className="p-3 rounded-lg transition-colors cursor-pointer hover:opacity-80"
              style={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--surface-border-subtle)",
              }}
              onClick={() => window.open(`/projects?decl=${decl.declNumber}`, "_blank")}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: sc.bg,
                    color: sc.color,
                    border: `1px solid ${sc.border}`,
                  }}
                >
                  {decl.declNumber}
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: sc.color }}
                >
                  {decl.status}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                {decl.title}
              </p>
              {decl.decision && (
                <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {decl.decision.slice(0, 150)}{decl.decision.length > 150 ? "..." : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
