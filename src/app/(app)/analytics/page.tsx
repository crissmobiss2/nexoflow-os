"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  TrendingUp,
  DollarSign,
  BarChart3,
  Brain,
  ArrowLeft,
  Download,
  Filter,
  X,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: "This Month", value: "this-month" },
  { label: "Last 3 Months", value: "last-3" },
  { label: "This Year", value: "this-year" },
  { label: "All Time", value: "all" },
  { label: "Custom", value: "custom" },
] as const;

const TYPE_PILLS = ["All", "SaaS", "Mobile", "Desktop", "Web", "AI", "Other"] as const;

const STATUS_OPTIONS = [
  { key: "brief", label: "Brief" },
  { key: "scored", label: "Scored" },
  { key: "scoped", label: "Scoped" },
  { key: "architected", label: "Architected" },
  { key: "generating", label: "Generating" },
  { key: "ready", label: "Ready" },
  { key: "archived", label: "Archived" },
];

const STATUS_COLORS: Record<string, string> = {
  brief: "hsl(220, 12%, 50%)",
  scored: "hsl(207, 90%, 62%)",
  scoped: "hsl(262, 83%, 68%)",
  architected: "hsl(35, 90%, 58%)",
  generating: "hsl(142, 68%, 52%)",
  ready: "hsl(142, 80%, 45%)",
  archived: "hsl(0, 12%, 40%)",
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

const TYPE_MAP: Record<string, string[]> = {
  All: [],
  SaaS: ["saas"],
  Mobile: ["mobile_app"],
  Desktop: ["desktop_app"],
  Web: ["website", "web_app", "portal", "ecommerce", "marketplace"],
  AI: ["ai_product"],
  Other: ["internal_tool"],
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

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

// ─── Chart Card ───────────────────────────────────────────────────────────────

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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color ?? "var(--text-secondary)" }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Date range helpers ───────────────────────────────────────────────────────

function getDateRange(preset: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (preset) {
    case "this-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    case "last-3": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 3);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    case "this-year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    default:
      return {};
  }
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
  return `$${Math.round(val).toLocaleString()}`;
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m!, 10) - 1] ?? m} ${y!.slice(2)}`;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(overview: any, byStatus: any[], byType: any[], revenue: any[], volume: any[]) {
  const lines: string[] = [];
  lines.push("NexoFlow Analytics Export");
  lines.push("");
  lines.push("Overview");
  lines.push(`Total Clients,${overview?.totalClients ?? 0}`);
  lines.push(`Total Projects,${overview?.totalProjects ?? 0}`);
  lines.push(`Win Rate,${overview?.winRate ?? 0}%`);
  lines.push(`Avg Deal Value,${formatCurrency(overview?.avgDealValue ?? 0)}`);
  lines.push(`Pipeline Value,${formatCurrency(overview?.pipelineValue ?? 0)}`);
  lines.push(`AI Conversations,${overview?.totalConversations ?? 0}`);
  lines.push("");
  lines.push("Projects by Status");
  lines.push("Status,Count");
  for (const s of byStatus) lines.push(`${s.label},${s.value}`);
  lines.push("");
  lines.push("Projects by Type");
  lines.push("Type,Count");
  for (const t of byType) lines.push(`${t.label},${t.value}`);
  lines.push("");
  lines.push("Revenue Forecast (by Month)");
  lines.push("Month,Revenue");
  for (const r of revenue) lines.push(`${r.month},${r.total}`);
  lines.push("");
  lines.push("Project Volume (by Month)");
  lines.push("Month,Count");
  for (const v of volume) lines.push(`${v.month},${v.value}`);

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexoflow-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Date range state
  const [datePreset, setDatePreset] = useState(searchParams.get("preset") ?? "all");
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") ?? "");

  // Type filter
  const [activeTypePill, setActiveTypePill] = useState(searchParams.get("type") ?? "All");

  // Status filter (clicking bar chart toggles this)
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    const s = searchParams.get("status");
    return s ? s.split(",") : [];
  });

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (datePreset !== "all") params.set("preset", datePreset);
    if (datePreset === "custom" && customFrom) params.set("from", customFrom);
    if (datePreset === "custom" && customTo) params.set("to", customTo);
    if (activeTypePill !== "All") params.set("type", activeTypePill);
    if (statusFilter.length > 0) params.set("status", statusFilter.join(","));
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [datePreset, customFrom, customTo, activeTypePill, statusFilter, router, pathname]);

  // Compute date range for API calls
  const dateRange = datePreset === "custom"
    ? { dateFrom: customFrom || undefined, dateTo: customTo || undefined }
    : getDateRange(datePreset);

  const typeParam = activeTypePill !== "All" ? TYPE_MAP[activeTypePill]?.join(",") : undefined;

  const filterInput = {
    ...dateRange,
    type: typeParam,
  };

  // Queries
  const { data: overview } = api.analytics.overview.useQuery(filterInput);
  const { data: byStatus } = api.analytics.byStatus.useQuery(filterInput);
  const { data: byType } = api.analytics.byType.useQuery(filterInput);
  const { data: revenue } = api.analytics.revenue.useQuery(filterInput);
  const { data: volume } = api.analytics.volume.useQuery(filterInput);
  const { data: leadFunnel } = api.analytics.leadFunnel.useQuery();
  const { data: leadSources } = api.analytics.leadSources.useQuery();
  const { data: revenuePipeline } = api.analytics.revenuePipeline.useQuery();
  const { data: winLoss } = api.analytics.winLossInsights.useQuery();
  const { data: revenueSummary } = api.invoices.revenueSummary.useQuery();
  const weeklyReport = api.analytics.generateWeeklyReport.useMutation();
  const [reportSent, setReportSent] = useState(false);

  const statusData = byStatus ?? [];
  const typeData = byType ?? [];
  const revenueData = revenue ?? [];
  const volumeData = volume ?? [];

  // Toggle status filter on bar click
  const handleStatusBarClick = useCallback((data: any) => {
    if (!data?.statusKey) return;
    setStatusFilter((prev) => {
      if (prev.includes(data.statusKey)) {
        return prev.filter((s) => s !== data.statusKey);
      }
      return [...prev, data.statusKey];
    });
  }, []);

  // Filter status chart data based on clicked bars
  const filteredStatusData = statusFilter.length > 0
    ? statusData.filter((d) => statusFilter.includes(d.statusKey))
    : statusData;

  const clearFilters = useCallback(() => {
    setDatePreset("all");
    setCustomFrom("");
    setCustomTo("");
    setActiveTypePill("All");
    setStatusFilter([]);
  }, []);

  const hasFilters = datePreset !== "all" || activeTypePill !== "All" || statusFilter.length > 0;

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
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Analytics
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", border: "1px solid var(--surface-border)" }}
              >
                <X className="w-3 h-3" />
                Clear Filters
              </button>
            )}
            <button
              onClick={() => downloadCSV(overview, statusData, typeData, revenueData, volumeData)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          </div>
        </div>
        <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
          Pipeline metrics, project distribution, and revenue overview
        </p>
      </div>

      {/* ── Date Range Picker ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setDatePreset(preset.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              datePreset === preset.value
                ? { background: "hsl(207 90% 62% / 0.15)", color: "hsl(207, 90%, 62%)" }
                : { background: "var(--surface-elevated)", color: "var(--text-muted)" }
            }
          >
            {preset.label}
          </button>
        ))}
        {datePreset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="nf-input text-xs px-2 py-1.5 rounded-lg"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="nf-input text-xs px-2 py-1.5 rounded-lg"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
            />
          </div>
        )}
      </div>

      {/* ── Type Filter Pills ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        {TYPE_PILLS.map((pill) => (
          <button
            key={pill}
            onClick={() => setActiveTypePill(pill)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={
              activeTypePill === pill
                ? { background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }
                : { background: "var(--surface-elevated)", color: "var(--text-muted)" }
            }
          >
            {pill}
          </button>
        ))}
      </div>

      {/* ── Status Filter Checkboxes ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Status:</span>
        {STATUS_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={statusFilter.includes(opt.key)}
              onChange={() => {
                setStatusFilter((prev) =>
                  prev.includes(opt.key)
                    ? prev.filter((s) => s !== opt.key)
                    : [...prev, opt.key],
                );
              }}
              className="rounded"
              style={{ accentColor: STATUS_COLORS[opt.key] ?? "var(--brand-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      {/* ── Metrics Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total Clients"
          value={(overview?.totalClients ?? 0).toLocaleString()}
          icon={Users}
          color="hsl(220, 90%, 62%)"
        />
        <MetricCard
          label="Total Projects"
          value={(overview?.totalProjects ?? 0).toLocaleString()}
          icon={FolderKanban}
          color="hsl(262, 83%, 68%)"
        />
        <MetricCard
          label="Win Rate"
          value={`${overview?.winRate ?? 0}%`}
          icon={TrendingUp}
          color="hsl(142, 68%, 52%)"
          subtitle={
            (overview?.winRateTotal ?? 0) > 0
              ? `${overview?.winRateWon ?? 0} of ${overview?.winRateTotal ?? 0} scored projects`
              : "No scored projects yet"
          }
        />
        <MetricCard
          label="Avg Deal Value"
          value={formatCurrency(overview?.avgDealValue ?? 0)}
          icon={DollarSign}
          color="hsl(35, 90%, 58%)"
          subtitle={
            (overview?.parsedBudgetCount ?? 0) > 0
              ? `Based on ${overview?.parsedBudgetCount ?? 0} projects with budgets`
              : "No budget data"
          }
        />
        <MetricCard
          label="Pipeline Value"
          value={formatCurrency(overview?.pipelineValue ?? 0)}
          icon={BarChart3}
          color="hsl(207, 90%, 60%)"
          subtitle={
            (overview?.pipelineValue ?? 0) > 0
              ? "Active (non-archived) projects"
              : "No active pipeline"
          }
        />
        <MetricCard
          label="AI Conversations"
          value={(overview?.totalConversations ?? 0).toLocaleString()}
          icon={Brain}
          color="hsl(180, 80%, 45%)"
        />
      </div>

      {/* ── Charts Row 1 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Projects by Status — interactive bar chart */}
        <ChartCard title="Projects by Status (click bar to filter)">
          {statusData.every((d) => d.value === 0) ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No projects yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} onClick={(e: any) => { const payload = e?.activePayload?.[0]?.payload; if (payload) handleStatusBarClick(payload); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-elevated)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer">
                  {statusData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={statusFilter.length === 0 || statusFilter.includes(entry.statusKey) ? 1 : 0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Projects by Type — pie chart */}
        <ChartCard title="Projects by Type">
          {typeData.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No projects yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {typeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "10px", color: "var(--text-muted)" }}
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Lead Funnel ─────────────────────────────────────────────────────── */}
      {(leadFunnel?.total ?? 0) > 0 && (
        <ChartCard title="Lead Conversion Funnel">
          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{leadFunnel?.total ?? 0}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Total Leads</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: "hsl(142, 68%, 52%)" }}>{leadFunnel?.conversionRate ?? 0}%</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Won Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: "hsl(207, 90%, 62%)" }}>{leadFunnel?.demoConversionRate ?? 0}%</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Demo → Won</div>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(142, 68%, 52%)" }}>
                <Target className="w-3 h-3" /> {leadFunnel?.won ?? 0} won
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(0, 70%, 60%)" }}>
                <X className="w-3 h-3" /> {leadFunnel?.lost ?? 0} lost
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {(leadFunnel?.stages ?? []).map((stage) => (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="text-xs w-28 text-right shrink-0" style={{ color: "var(--text-muted)" }}>{stage.label}</div>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(stage.pct, 1)}%`,
                      background: stage.key === "won" ? "hsl(142, 68%, 52%)" : stage.key === "lost" ? "hsl(0, 70%, 60%)" : "hsl(207, 90%, 62%)",
                      opacity: stage.count === 0 ? 0.2 : 1,
                    }}
                  />
                </div>
                <div className="text-xs w-16 shrink-0" style={{ color: "var(--text-secondary)" }}>{stage.count} ({stage.pct}%)</div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* ── Charts Row 2 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Revenue Forecast — line chart */}
        <ChartCard title="Revenue Forecast (Pipeline by Month)">
          {revenueData.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No budget data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickFormatter={shortMonth}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickFormatter={(v: number) => formatCurrency(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(207, 90%, 60%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(207, 90%, 60%)" }}
                  activeDot={{ r: 5 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Project Volume Over Time — area chart */}
        <ChartCard title="Project Volume Over Time">
          {volumeData.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No projects yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(262, 83%, 68%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(262, 83%, 68%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickFormatter={shortMonth}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(262, 83%, 68%)"
                  strokeWidth={2}
                  fill="url(#volumeGradient)"
                  dot={{ r: 3, fill: "hsl(262, 83%, 68%)" }}
                  activeDot={{ r: 5 }}
                  name="Projects"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Lead Source Attribution + Revenue Pipeline ──────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Lead Source Attribution */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Lead Source Attribution</h3>
          {!leadSources || leadSources.total === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>No lead data yet</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{leadSources.total}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>total leads</span>
              </div>
              {leadSources.bySource.slice(0, 8).map((s, i) => {
                const colors = ["hsl(220,90%,62%)", "hsl(262,83%,68%)", "hsl(142,68%,52%)", "hsl(35,90%,60%)", "hsl(0,70%,60%)", "hsl(207,70%,60%)", "hsl(40,90%,58%)", "hsl(180,60%,55%)"];
                const color = colors[i % colors.length]!;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium capitalize" style={{ color: "var(--text-secondary)" }}>
                        {s.source.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{s.count} ({s.pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue Pipeline */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Revenue Pipeline (Invoices)</h3>
          {!revenuePipeline ? (
            <div className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>No invoice data yet</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Collected", value: revenuePipeline.totalCollected, color: "hsl(142, 68%, 52%)" },
                  { label: "Pipeline", value: revenuePipeline.totalPipeline, color: "hsl(207, 70%, 60%)" },
                  { label: "Overdue", value: revenuePipeline.overdue, color: "hsl(0, 70%, 60%)" },
                  { label: "Draft", value: revenuePipeline.draft, color: "hsl(220, 14%, 55%)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: "var(--surface-elevated)" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
                    <div className="text-lg font-bold" style={{ color }}>${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}</div>
                  </div>
                ))}
              </div>
              {revenuePipeline.totalCollected + revenuePipeline.totalPipeline > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Collection Rate</div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((revenuePipeline.totalCollected / (revenuePipeline.totalCollected + revenuePipeline.totalPipeline + revenuePipeline.overdue)) * 100)}%`,
                        background: "hsl(142, 68%, 52%)",
                      }}
                    />
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {Math.round((revenuePipeline.totalCollected / (revenuePipeline.totalCollected + revenuePipeline.totalPipeline + revenuePipeline.overdue)) * 100)}% of total invoiced collected
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── MRR / ARR / Revenue Summary ─────────────────────────────────── */}
        {revenueSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "MRR", value: `$${(revenueSummary.mrr / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`, color: "hsl(262, 83%, 68%)" },
              { label: "ARR", value: `$${(revenueSummary.arr / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`, color: "hsl(142, 68%, 52%)" },
              { label: "Collected", value: `$${(revenueSummary.totalCollected / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`, color: "hsl(207, 90%, 62%)" },
              { label: "Pipeline", value: `$${(revenueSummary.pipeline / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`, color: "hsl(35, 90%, 58%)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{label}</div>
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Win / Loss AI Insights ───────────────────────────────────────── */}
        {winLoss && (
          <ChartCard title="AI Win/Loss Insights">
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{winLoss.summary}</p>
            {winLoss.patterns?.length > 0 && (
              <div className="space-y-3">
                {winLoss.patterns.map((p, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "hsl(262, 83%, 68%)" }}>{p.title}</div>
                    <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{p.insight}</div>
                    <div className="text-xs font-medium" style={{ color: "hsl(142, 68%, 52%)" }}>→ {p.action}</div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}

        {/* ── Weekly Report ────────────────────────────────────────────────── */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Weekly AI Business Report</h3>
            <button
              onClick={() => weeklyReport.mutate({}, { onSuccess: () => setReportSent(true) })}
              disabled={weeklyReport.isPending || reportSent}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--brand-gradient)" }}
            >
              {weeklyReport.isPending ? "Generating…" : reportSent ? "✓ Sent to your email" : "Send Weekly Report"}
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Claude analyzes your last 7 days (leads, deals, revenue) and emails a strategic summary to crissmobiss@gmail.com.
          </p>
          {weeklyReport.data && (
            <div className="mt-3 p-3 rounded-lg text-xs whitespace-pre-wrap" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
              {weeklyReport.data.report}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
