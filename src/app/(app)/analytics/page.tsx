export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import {
  projects,
  clients,
  aiConversations,
  opportunityScores,
} from "@/server/db/schema";
import { count, sql, and, isNotNull } from "drizzle-orm";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  TrendingUp,
  DollarSign,
  BarChart3,
  Brain,
  ArrowLeft,
} from "lucide-react";

// ─── Budget parsing helpers ───────────────────────────────────────────────────

function parseBudgetLow(range: string | null): number | null {
  if (!range) return null;
  const match = range.match(/\$?([\d,.]+)\s*([kKmMbB])?/);
  if (!match) return null;
  let val = parseFloat(match[1]!.replace(/,/g, ""));
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") val *= 1_000;
  else if (suffix === "m" || suffix === "b") val *= 1_000_000;
  return val;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
  return `$${Math.round(val).toLocaleString()}`;
}

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  brief: "hsl(220, 12%, 50%)",
  scored: "hsl(207, 90%, 62%)",
  scoped: "hsl(262, 83%, 68%)",
  architected: "hsl(35, 90%, 58%)",
  generating: "hsl(142, 68%, 52%)",
  ready: "hsl(142, 80%, 45%)",
  archived: "hsl(0, 12%, 40%)",
};

const STATUS_LABEL: Record<string, string> = {
  brief: "Brief",
  scored: "Scored",
  scoped: "Scoped",
  architected: "Architected",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
};

const TYPE_COLORS: Record<string, string> = {
  website: "hsl(220, 90%, 62%)",
  web_app: "hsl(262, 83%, 68%)",
  mobile_app: "hsl(142, 68%, 52%)",
  desktop_app: "hsl(35, 90%, 58%)",
  saas: "hsl(0, 72%, 58%)",
  marketplace: "hsl(207, 90%, 60%)",
  internal_tool: "hsl(300, 60%, 60%)",
  ai_product: "hsl(180, 80%, 45%)",
  ecommerce: "hsl(15, 85%, 55%)",
  portal: "hsl(50, 80%, 50%)",
};

const TYPE_LABEL: Record<string, string> = {
  website: "Website",
  web_app: "Web App",
  mobile_app: "Mobile App",
  desktop_app: "Desktop App",
  saas: "SaaS",
  marketplace: "Marketplace",
  internal_tool: "Internal Tool",
  ai_product: "AI Product",
  ecommerce: "eCommerce",
  portal: "Portal",
};

// ─── Metric card component ────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:scale-[1.01]"
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}
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
      {subtitle && (
        <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${className ?? ""}`}
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  // ── Aggregate queries ───────────────────────────────────────────────────────

  const [totalClients, totalProjects, totalConversations] = await Promise.all([
    db.select({ value: count() }).from(clients).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(projects).then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(aiConversations)
      .then((r) => r[0]?.value ?? 0),
  ]);

  // Win rate: scored projects with "build" or "prioritise" decision
  const winRateRaw = await db
    .select({
      total: count(),
      won: sql<number>`count(*) filter (where ${projects.scoreDecision} in ('build', 'prioritise'))`,
    })
    .from(projects)
    .where(isNotNull(projects.scoreDecision));
  const winRateData = winRateRaw[0] ?? { total: 0, won: 0 };
  const winRate =
    winRateData.total > 0
      ? Math.round((winRateData.won / winRateData.total) * 100)
      : 0;

  // Budget data for average deal value and pipeline
  const budgetRows = await db
    .select({ budgetRange: projects.budgetRange, status: projects.status })
    .from(projects)
    .where(isNotNull(projects.budgetRange));

  const parsedBudgets: { low: number; status: string }[] = [];
  for (const r of budgetRows) {
    const low = parseBudgetLow(r.budgetRange);
    if (low !== null) {
      parsedBudgets.push({ low, status: r.status });
    }
  }

  const avgDealValue =
    parsedBudgets.length > 0
      ? Math.round(
          parsedBudgets.reduce((sum, b) => sum + b.low, 0) / parsedBudgets.length,
        )
      : 0;

  const pipelineValue = parsedBudgets
    .filter((b) => b.status !== "archived")
    .reduce((sum, b) => sum + b.low, 0);

  // ── Projects by status ──────────────────────────────────────────────────────

  const statusGroups = await db
    .select({
      status: projects.status,
      value: count(),
    })
    .from(projects)
    .groupBy(projects.status)
    .orderBy(projects.status);

  const statusMap = new Map(statusGroups.map((r) => [r.status, r.value]));
  const statusChartData = Object.keys(STATUS_LABEL).map((s) => ({
    label: STATUS_LABEL[s] ?? s,
    value: statusMap.get(s as (typeof projects)["status"]["_"]["data"]) ?? 0,
    color: STATUS_COLORS[s] ?? "hsl(220, 12%, 50%)",
  }));
  const maxStatusCount = Math.max(...statusChartData.map((d) => d.value), 1);

  // ── Projects by type ────────────────────────────────────────────────────────

  const typeGroups = await db
    .select({
      type: projects.projectType,
      value: count(),
    })
    .from(projects)
    .groupBy(projects.projectType)
    .orderBy(projects.projectType);

  const typeChartData = typeGroups.map((r) => ({
    label: TYPE_LABEL[r.type] ?? r.type,
    value: r.value,
    color: TYPE_COLORS[r.type] ?? "hsl(220, 90%, 62%)",
  }));
  typeChartData.sort((a, b) => b.value - a.value);
  const maxTypeCount = Math.max(...typeChartData.map((d) => d.value), 1);

  // ── Revenue forecast: pipeline by month (createdAt) ─────────────────────────

  const timelineRows = await db
    .select({
      month: sql<string>`to_char(${projects.createdAt}, 'YYYY-MM')`,
      budgetRange: projects.budgetRange,
    })
    .from(projects)
    .where(isNotNull(projects.budgetRange))
    .orderBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`);

  const pipelineByMonth = new Map<string, number>();
  for (const r of timelineRows) {
    const low = parseBudgetLow(r.budgetRange);
    if (low !== null) {
      pipelineByMonth.set(r.month, (pipelineByMonth.get(r.month) ?? 0) + low);
    }
  }
  const revenueData = Array.from(pipelineByMonth.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const maxRevenue = Math.max(...revenueData.map((d) => d.total), 1);

  // ── Project volume over time ────────────────────────────────────────────────

  const volumeRows = await db
    .select({
      month: sql<string>`to_char(${projects.createdAt}, 'YYYY-MM')`,
      value: count(),
    })
    .from(projects)
    .groupBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`);

  const volumeData = volumeRows.map((r) => ({
    month: r.month,
    value: r.value,
  }));
  const maxVolume = Math.max(...volumeData.map((d) => d.value), 1);

  // ── Month label formatter ───────────────────────────────────────────────────

  function shortMonth(ym: string): string {
    const [y, m] = ym.split("-");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[parseInt(m!, 10) - 1] ?? m} ${y!.slice(2)}`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs mb-3 hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-1.5 h-5 rounded-full"
            style={{ background: "var(--brand-gradient)" }}
          />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Analytics
          </h1>
        </div>
        <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
          Pipeline metrics, project distribution, and revenue overview
        </p>
      </div>

      {/* ── Metrics Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total Clients"
          value={totalClients.toLocaleString()}
          icon={Users}
          color="hsl(220, 90%, 62%)"
        />
        <MetricCard
          label="Total Projects"
          value={totalProjects.toLocaleString()}
          icon={FolderKanban}
          color="hsl(262, 83%, 68%)"
        />
        <MetricCard
          label="Win Rate"
          value={`${winRate}%`}
          icon={TrendingUp}
          color="hsl(142, 68%, 52%)"
          subtitle={
            winRateData.total > 0
              ? `${winRateData.won} of ${winRateData.total} scored projects`
              : "No scored projects yet"
          }
        />
        <MetricCard
          label="Avg Deal Value"
          value={formatCurrency(avgDealValue)}
          icon={DollarSign}
          color="hsl(35, 90%, 58%)"
          subtitle={
            parsedBudgets.length > 0
              ? `Based on ${parsedBudgets.length} projects with budgets`
              : "No budget data"
          }
        />
        <MetricCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          icon={BarChart3}
          color="hsl(207, 90%, 60%)"
          subtitle={
            pipelineValue > 0
              ? "Active (non-archived) projects"
              : "No active pipeline"
          }
        />
        <MetricCard
          label="AI Conversations"
          value={totalConversations.toLocaleString()}
          icon={Brain}
          color="hsl(180, 80%, 45%)"
        />
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Projects by Status - Horizontal bar chart */}
        <ChartCard title="Projects by Status">
          {statusChartData.every((d) => d.value === 0) ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No projects yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {statusChartData.map((d) => (
                <div key={d.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: d.color }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {d.label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      {d.value}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--surface-elevated)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(d.value / maxStatusCount) * 100}%`,
                        background: d.color,
                        opacity: d.value > 0 ? 1 : 0.3,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Projects by Type - Simple bar chart (SVG) */}
        <ChartCard title="Projects by Type">
          {typeChartData.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No projects yet
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2 h-36">
              {typeChartData.map((d) => {
                const pct = (d.value / maxTypeCount) * 100;
                return (
                  <div
                    key={d.label}
                    className="flex flex-col items-center flex-1 min-w-0"
                  >
                    <span
                      className="text-[10px] font-semibold mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {d.value}
                    </span>
                    <div
                      className="w-full rounded-t-sm transition-all duration-500"
                      style={{
                        height: `${Math.max(pct, 4)}%`,
                        background: d.color,
                        opacity: 0.85,
                      }}
                    />
                    <span
                      className="text-[9px] mt-1.5 truncate w-full text-center"
                      style={{ color: "var(--text-muted)" }}
                      title={d.label}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 2 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Revenue Forecast - SVG bar chart */}
        <ChartCard title="Revenue Forecast (Pipeline by Month)">
          {revenueData.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No budget data available
            </div>
          ) : (
            <div>
              <svg
                width="100%"
                height="160"
                viewBox={`0 0 ${Math.max(revenueData.length * 60, 200)} 160`}
                preserveAspectRatio="xMidYMid meet"
                className="overflow-visible"
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = 140 - frac * 120;
                  return (
                    <g key={frac}>
                      <line
                        x1="0"
                        y1={y}
                        x2={Math.max(revenueData.length * 60, 200)}
                        y2={y}
                        stroke="var(--surface-border)"
                        strokeWidth="0.5"
                      />
                      <text
                        x="0"
                        y={y - 3}
                        fontSize="8"
                        fill="var(--text-muted)"
                      >
                        {formatCurrency(maxRevenue * frac)}
                      </text>
                    </g>
                  );
                })}
                {/* Bars */}
                {revenueData.map((d, i) => {
                  const barW = 30;
                  const x = i * 60 + 15;
                  const h = (d.total / maxRevenue) * 120;
                  return (
                    <g key={d.month}>
                      <rect
                        x={x}
                        y={140 - h}
                        width={barW}
                        height={Math.max(h, 2)}
                        rx="3"
                        fill="hsl(207, 90%, 60%)"
                        opacity="0.8"
                      />
                      <text
                        x={x + barW / 2}
                        y="155"
                        fontSize="7"
                        textAnchor="middle"
                        fill="var(--text-muted)"
                      >
                        {shortMonth(d.month)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </ChartCard>

        {/* Project Volume Over Time - SVG line chart */}
        <ChartCard title="Project Volume Over Time">
          {volumeData.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No projects yet
            </div>
          ) : (
            <div>
              <svg
                width="100%"
                height="160"
                viewBox={`0 0 ${Math.max(volumeData.length * 60, 200)} 160`}
                preserveAspectRatio="xMidYMid meet"
                className="overflow-visible"
              >
                {/* Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = 140 - frac * 120;
                  return (
                    <g key={frac}>
                      <line
                        x1="0"
                        y1={y}
                        x2={Math.max(volumeData.length * 60, 200)}
                        y2={y}
                        stroke="var(--surface-border)"
                        strokeWidth="0.5"
                      />
                      <text
                        x="0"
                        y={y - 3}
                        fontSize="8"
                        fill="var(--text-muted)"
                      >
                        {Math.round(maxVolume * frac)}
                      </text>
                    </g>
                  );
                })}
                {/* Polyline */}
                <polyline
                  fill="none"
                  stroke="hsl(262, 83%, 68%)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={volumeData
                    .map((d, i) => {
                      const x = i * 60 + 30;
                      const y = 140 - (d.value / maxVolume) * 120;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
                {/* Area fill */}
                <polygon
                  fill="url(#volumeGradient)"
                  opacity="0.15"
                  points={`0,140 ${volumeData
                    .map((d, i) => {
                      const x = i * 60 + 30;
                      const y = 140 - (d.value / maxVolume) * 120;
                      return `${x},${y}`;
                    })
                    .join(" ")} ${(volumeData.length - 1) * 60 + 30},140`}
                />
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(262, 83%, 68%)" stopOpacity="1" />
                    <stop offset="100%" stopColor="hsl(262, 83%, 68%)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Dots + Labels */}
                {volumeData.map((d, i) => {
                  const x = i * 60 + 30;
                  const y = 140 - (d.value / maxVolume) * 120;
                  return (
                    <g key={d.month}>
                      <circle
                        cx={x}
                        cy={y}
                        r="3"
                        fill="hsl(262, 83%, 68%)"
                        stroke="var(--surface-card)"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y="155"
                        fontSize="7"
                        textAnchor="middle"
                        fill="var(--text-muted)"
                      >
                        {shortMonth(d.month)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
