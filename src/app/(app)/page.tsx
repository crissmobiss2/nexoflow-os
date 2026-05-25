export const revalidate = 30;

import { db } from "@/server/db";
import { projects, clients, aiConversations, knowledgeSnippets, leads } from "@/server/db/schema";
import { desc, sql, count, eq, gte } from "drizzle-orm";
import Link from "next/link";
import { formatScore } from "@/lib/utils";
import {
  Users, FolderKanban, Brain, BookOpen, Plus, ArrowRight,
  Zap, TrendingUp, Sparkles, Shield, BarChart2, Code,
  ChevronRight, Target,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  brief: "Brief", scored: "Scored", scoped: "Scoped",
  architected: "Architected", generating: "Generating", ready: "Ready", archived: "Archived",
};

const AI_MODES = [
  { id: "general",     label: "General",     icon: Brain,      desc: "Full second brain context",          color: "hsl(220, 90%, 62%)", href: "/ai" },
  { id: "architect",   label: "Architect",   icon: Zap,        desc: "System design decisions",            color: "hsl(262, 83%, 68%)", href: "/ai" },
  { id: "code_review", label: "Code Review", icon: Code,       desc: "Security, bugs & performance",       color: "hsl(207, 90%, 60%)", href: "/ai" },
  { id: "security",    label: "Security",    icon: Shield,     desc: "OWASP, auth & vulnerability audit",  color: "hsl(0, 72%, 58%)",   href: "/ai" },
  { id: "performance", label: "Performance", icon: BarChart2,  desc: "Web Vitals & query optimisation",    color: "hsl(35, 90%, 58%)",  href: "/ai" },
];

export default async function DashboardPage() {
  const [
    recentProjects,
    totalClients,
    totalProjects,
    totalConversations,
    knowledgeStats,
    leadStats,
  ] = await Promise.all([
    db.query.projects.findMany({
      limit: 6,
      orderBy: [desc(projects.createdAt)],
      with: { client: true, score: true },
    }),
    db.select({ count: count() }).from(clients).then((r) => r[0]?.count ?? 0),
    db.select({ count: count() }).from(projects).then((r) => r[0]?.count ?? 0),
    db.select({ count: count() }).from(aiConversations).then((r) => r[0]?.count ?? 0),
    db.select({
      total: sql<number>`count(*)::int`,
      categories: sql<number>`count(distinct ${knowledgeSnippets.category})::int`,
    }).from(knowledgeSnippets).then((r) => r[0] ?? { total: 0, categories: 0 }),
    Promise.all([
      db.select({ count: count() }).from(leads).then((r) => r[0]?.count ?? 0),
      db.select({ count: count() }).from(leads).where(gte(leads.aiScore, 70)).then((r) => r[0]?.count ?? 0),
      db.select({ count: count() }).from(leads).where(eq(leads.status, "demo_generated")).then((r) => r[0]?.count ?? 0),
      db.select({ count: count() }).from(leads).where(eq(leads.status, "won")).then((r) => r[0]?.count ?? 0),
    ]).then(([total, hot, demoReady, won]) => ({ total, hot, demoReady, won })),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>NexoFlow OS</h1>
        </div>
        <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
          Your AI-powered engineering intelligence platform
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Clients",            value: totalClients,                     icon: Users,       href: "/clients",   color: "hsl(220, 90%, 62%)" },
          { label: "Projects",           value: totalProjects,                    icon: FolderKanban,href: "/projects",  color: "hsl(262, 83%, 68%)" },
          { label: "AI Conversations",   value: totalConversations,               icon: Brain,       href: "/ai",        color: "hsl(142, 68%, 52%)" },
          { label: "Knowledge Snippets", value: knowledgeStats.total.toLocaleString(), icon: BookOpen, href: "/knowledge", color: "hsl(35, 90%, 58%)" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl p-5 transition-all hover:scale-[1.01] group"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: stat.color }} />
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>{stat.value}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Lead Pipeline quick stats */}
      {leadStats.total > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(262 83% 68% / 0.12)" }}>
                <Target className="w-4 h-4" style={{ color: "hsl(262, 83%, 68%)" }} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Lead Pipeline</h2>
            </div>
            <Link href="/leads" className="text-xs hover:underline" style={{ color: "var(--brand-primary)" }}>View all →</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Leads", value: leadStats.total, color: "hsl(220, 90%, 62%)", href: "/leads" },
              { label: "🔥 Hot Leads", value: leadStats.hot, color: "hsl(35, 90%, 60%)", href: "/leads" },
              { label: "Demo Ready", value: leadStats.demoReady, color: "hsl(262, 83%, 68%)", href: "/leads" },
              { label: "Won", value: leadStats.won, color: "hsl(142, 80%, 45%)", href: "/leads" },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="rounded-xl px-4 py-3 text-center transition-all hover:scale-[1.02]"
                style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25` }}
              >
                <div className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* AI Studio modes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Studio</h2>
          <Link href="/ai" className="text-xs hover:underline" style={{ color: "var(--brand-primary)" }}>Open Studio →</Link>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {AI_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                key={mode.id}
                href={mode.href}
                className="rounded-xl p-4 transition-all hover:scale-[1.02] group cursor-pointer"
                style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${mode.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: mode.color }} />
                </div>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{mode.label}</div>
                <div className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>{mode.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Knowledge bar */}
      <div
        className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(35 90% 58% / 0.15)" }}>
          <Sparkles className="w-5 h-5" style={{ color: "hsl(35, 90%, 58%)" }} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
            Second Brain: {knowledgeStats.total.toLocaleString()} snippets across {knowledgeStats.categories} categories
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Architecture · Security · Performance · Frontend · Backend · Mobile · DevOps · AI · Testing · Design Patterns: all searchable and automatically injected into every AI generation.
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/knowledge"
            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
          >
            Browse
          </Link>
          <Link
            href="/playbooks"
            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
          >
            Playbooks
          </Link>
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Projects</h2>
          <Link href="/projects" className="text-xs hover:underline" style={{ color: "var(--brand-primary)" }}>View all →</Link>
        </div>

        {recentProjects.length === 0 ? (
          <div
            className="rounded-xl p-10 flex flex-col items-center justify-center text-center"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <TrendingUp className="w-8 h-8 mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No projects yet</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Onboard a client and kick off your first project</p>
            <Link href="/clients/new" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              <Plus className="w-3.5 h-3.5" /> Onboard Client
            </Link>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
            {recentProjects.map((project, i) => {
              const scoreInfo = project.score ? formatScore(project.score.totalScore) : null;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02] group"
                  style={{ borderBottom: i < recentProjects.length - 1 ? "1px solid var(--surface-border-subtle)" : "none" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand-primary)" }} />
                    <div>
                      <div className="text-sm font-medium group-hover:text-[var(--brand-primary)] transition-colors" style={{ color: "var(--text-primary)" }}>
                        {project.name}
                      </div>
                      <div className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                        {project.client?.name ?? "No client"} · {project.projectType.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
                      {STATUS_LABEL[project.status] ?? project.status}
                    </span>
                    {scoreInfo && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: scoreInfo.bgColor, color: scoreInfo.color, border: `1px solid ${scoreInfo.borderColor}` }}>
                        {project.score?.totalScore}/70
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
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
