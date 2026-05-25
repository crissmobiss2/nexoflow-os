"use client";

import { useState, useEffect, useRef } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/trpc/client";
import { renderMarkdown } from "@/lib/markdown";
import {
  CheckCircle2, Circle, ArrowLeft, FileText, Users, Lock, Loader2,
  Notebook, BookOpen, Map,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ token: string }>;
}

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "scope", label: "Scope", icon: FileText },
  { id: "roadmap", label: "Roadmap", icon: Map },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PortalInner({ token }: { token: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  // Fetch project via tRPC
  const { data: project, isLoading, error } = api.projects.getPortalProject.useQuery(
    { token },
    { enabled: !!token },
  );

  // Fetch playbook
  const { data: playbook, isLoading: playbookLoading } = api.playbooks.getPortalPlaybook.useQuery(
    { token },
    { enabled: !!token && authenticated && activeTab === "roadmap" },
  );

  // Password protection
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple client-facing effort: project name as password hint
    if (project && password.toLowerCase() === project.name.toLowerCase().replace(/\s+/g, "")) {
      setAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect access code. Hint: project name (no spaces, lowercase)");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Lock className="w-12 h-12 mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Project Not Found</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            This portal link is invalid or the project has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
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
            Back
          </Link>
          <span
            className="text-[11px] font-medium tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Client Portal
          </span>
        </div>

        {/* Auth screen */}
        <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "hsl(220, 90%, 62%, 0.1)" }}>
            <Lock className="w-8 h-8" style={{ color: "hsl(220, 90%, 62%)" }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            {project.name}
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Enter the access code to view this project portal.
          </p>
          <form onSubmit={handleAuth} className="w-full space-y-3">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access code"
              className="w-full px-4 py-3 rounded-xl text-sm bg-transparent outline-none"
              style={{
                color: "var(--text-primary)",
                background: "var(--surface-card)",
                border: "1px solid var(--surface-border)",
              }}
              autoFocus
            />
            {authError && (
              <p className="text-xs" style={{ color: "hsl(0, 72%, 58%)" }}>{authError}</p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              View Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const sortedPhases = [...(project.phases ?? [])].sort(
    (a, b) => a.phaseOrder - b.phaseOrder,
  );
  const completedPhases = sortedPhases.filter(
    (p) => p.status === "completed",
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

  const scopeArtifact = project.artifacts?.find(
    (a: any) => a.artifactType === "scope_doc",
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Back / branding */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <span
          className="text-[11px] font-medium tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Client Portal
        </span>
      </div>

      {/* Hero */}
      <div className="mb-8">
        <h1
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {project.name}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: `${(statusColor[project.status] ?? "hsl(220, 12%, 60%)")}15`,
              color: statusColor[project.status] ?? "var(--text-secondary)",
              border: `1px solid ${(statusColor[project.status] ?? "hsl(220, 12%, 60%)")}30`,
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
              {project.client.company ? ` · ${project.client.company}` : ""}
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

      {/* Tab Navigation - mobile responsive */}
      <div
        className="flex mb-8 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0"
        style={{ borderBottom: "1px solid var(--surface-border)" }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all shrink-0",
                active ? "border-b-2" : "opacity-60 hover:opacity-100",
              )}
              style={{
                color: active ? "var(--brand-primary)" : "var(--text-secondary)",
                borderColor: active ? "var(--brand-primary)" : "transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {/* Left column: brief */}
          <div className="sm:col-span-2 space-y-6 sm:space-y-8">
            {project.brief && (
              <section>
                <h2
                  className="text-xs font-semibold uppercase tracking-widest mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  Project Brief
                </h2>
                <div
                  className="rounded-xl p-4 sm:p-5 space-y-4"
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
                          {value as string}
                        </dd>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column: progress + timeline */}
          <div className="space-y-6 sm:space-y-8">
            {/* Milestone Progress */}
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                Milestone Progress
              </h2>
              <div
                className="rounded-xl p-4 sm:p-5"
                style={{
                  background: "hsl(222, 25%, 8%)",
                  border: "1px solid hsl(222, 22%, 14%)",
                }}
              >
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
                  {sortedPhases.map((phase: any) => (
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
                  className="rounded-xl p-4 sm:p-5"
                  style={{
                    background: "hsl(222, 25%, 8%)",
                    border: "1px solid hsl(222, 22%, 14%)",
                  }}
                >
                  <div className="space-y-4">
                    {sortedPhases.map((phase: any, i: number) => (
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
      )}

      {activeTab === "scope" && (
        <div>
          {scopeArtifact ? (
            <div
              className="rounded-xl p-4 sm:p-6"
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-10 h-10 mb-4" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Scope document not yet available.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "roadmap" && (
        <div className="relative">
          {/* Watermark */}
          <div
            className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.03]"
            style={{ zIndex: 0 }}
          >
            <div className="flex items-center justify-center h-full text-lg font-bold tracking-widest rotate-[-15deg] whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              Confidential: NexoFlow Methodology
            </div>
          </div>

          <div className="relative" style={{ zIndex: 1 }}>
            {playbookLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
              </div>
            ) : playbook ? (
              <div>
                {/* Playbook Header */}
                <div className="flex items-center gap-2 mb-4">
                  <Notebook className="w-4 h-4" style={{ color: "hsl(315, 70%, 60%)" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {playbook.playbookName}
                  </h2>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "hsl(222, 22%, 14%)", color: "var(--text-muted)" }}>
                    v{playbook.version}
                  </span>
                </div>

                {/* Estimated Timeline */}
                {project.timelineWeeks && (
                  <div
                    className="rounded-xl p-4 mb-6 flex items-center gap-3"
                    style={{
                      background: "hsl(142, 68%, 52%, 0.1)",
                      border: "1px solid hsl(142, 68%, 52%, 0.2)",
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(142, 68%, 52%, 0.2)" }}>
                      <Map className="w-4 h-4" style={{ color: "hsl(142, 68%, 52%)" }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "hsl(142, 68%, 52%)" }}>
                        Estimated Timeline: {project.timelineWeeks} weeks
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Based on the {playbook.playbookName} methodology
                      </p>
                    </div>
                  </div>
                )}

                {/* Playbook Content */}
                <div
                  className="rounded-xl p-4 sm:p-6"
                  style={{
                    background: "hsl(222, 25%, 8%)",
                    border: "1px solid hsl(222, 22%, 14%)",
                  }}
                >
                  <div className="prose-nexoflow" style={{ maxWidth: "none" }}>
                    {playbook.content.split("\n").map((line: string, i: number) => {
                      // Render checkboxes as read-only
                      if (line.includes("- [ ]") || line.includes("- [x]")) {
                        const checked = line.includes("[x]");
                        const text = line.replace(/-\s*\[[x ]?\]\s*/, "");
                        return (
                          <div key={i} className="flex items-start gap-2 py-1">
                            {checked ? (
                              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--status-success)" }} />
                            ) : (
                              <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "hsl(222, 22%, 30%)" }} />
                            )}
                            <span className="text-sm" style={{ color: checked ? "var(--text-secondary)" : "var(--text-primary)" }}>
                              {text}
                            </span>
                          </div>
                        );
                      }
                      // Render headers
                      if (line.startsWith("## ")) {
                        return (
                          <h3 key={i} className="text-base font-bold mt-6 mb-3" style={{ color: "var(--text-primary)" }}>
                            {line.replace("## ", "")}
                          </h3>
                        );
                      }
                      if (line.startsWith("### ")) {
                        return (
                          <h4 key={i} className="text-sm font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>
                            {line.replace("### ", "")}
                          </h4>
                        );
                      }
                      // Separators
                      if (line.trim() === "---") {
                        return <hr key={i} className="my-4" style={{ borderColor: "hsl(222, 22%, 14%)" }} />;
                      }
                      // Blockquotes
                      if (line.startsWith("> ")) {
                        return (
                          <blockquote key={i} className="text-sm italic py-1 px-3 my-2 rounded" style={{ background: "hsl(222, 22%, 10%)", color: "var(--text-secondary)", borderLeft: "2px solid hsl(315, 70%, 60%)" }}>
                            {line.replace("> ", "")}
                          </blockquote>
                        );
                      }
                      // Normal text
                      if (line.trim()) {
                        return (
                          <p key={i} className="text-sm leading-relaxed py-0.5" style={{ color: "var(--text-secondary)" }}>
                            {line}
                          </p>
                        );
                      }
                      return <div key={i} className="h-2" />;
                    })}
                  </div>
                </div>

                {/* Watermark overlay text */}
                <div
                  className="text-center mt-6 text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "hsl(222, 22%, 25%)" }}
                >
                  Confidential: NexoFlow Methodology
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Map className="w-10 h-10 mb-4" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Project roadmap playbook not yet available.
                </p>
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  The build playbook will appear here after it&apos;s generated.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        className="mt-12 sm:mt-16 pt-6 border-t text-center"
        style={{ borderColor: "hsl(222, 22%, 12%)" }}
      >
        <p
          className="text-[11px] tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Powered by <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>NexoFlow</span> &middot; Build Intelligence System
        </p>
      </footer>
    </div>
  );
}

export default function PortalPage({ params }: PageProps) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    );
  }

  return <PortalInner token={token} />;
}
