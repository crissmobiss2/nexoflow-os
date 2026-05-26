"use client";

import { api } from "@/lib/trpc/client";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { DollarSign, TrendingUp, Users, BarChart3, Clock, Target } from "lucide-react";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const COLORS = ["hsl(142,68%,52%)", "hsl(35,90%,58%)", "hsl(0,72%,58%)", "hsl(220,90%,62%)", "hsl(262,83%,68%)"];

export default function RevenuePage() {
  const { data: analytics } = api.analytics.overview.useQuery({});
  const { data: pipeline } = api.analytics.revenuePipeline.useQuery();
  const { data: leadFunnel } = api.analytics.leadFunnel.useQuery();
  const { data: invoices = [] } = api.invoices.list.useQuery();
  const { data: affiliateStats } = api.affiliates.stats.useQuery();
  const { data: timeByProject } = api.timeTracking.byProject.useQuery();

  // Revenue by month (last 6 months) from invoices
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const paid = invoices
      .filter((inv) => inv.status === "paid" && inv.paidDate && new Date(inv.paidDate).getMonth() === d.getMonth() && new Date(inv.paidDate).getFullYear() === d.getFullYear())
      .reduce((s, inv) => s + inv.total, 0);
    const outstanding = invoices
      .filter((inv) => (inv.status === "sent" || inv.status === "overdue") && new Date(inv.createdAt).getMonth() === d.getMonth() && new Date(inv.createdAt).getFullYear() === d.getFullYear())
      .reduce((s, inv) => s + inv.total, 0);
    return { month: label, paid: paid / 100, outstanding: outstanding / 100 };
  });

  const totalPaid = pipeline?.paid ?? 0;
  const totalOutstanding = (pipeline?.sent ?? 0) + (pipeline?.overdue ?? 0);
  const totalOverdue = pipeline?.overdue ?? 0;

  const statusBreakdown = [
    { name: "Paid", value: totalPaid / 100 },
    { name: "Outstanding", value: (pipeline?.sent ?? 0) / 100 },
    { name: "Overdue", value: totalOverdue / 100 },
  ].filter((s) => s.value > 0);

  const totalHours = (timeByProject ?? []).reduce((s, r) => s + r.totalMinutes, 0) / 60;
  const billableHours = (timeByProject ?? []).reduce((s, r) => s + r.billableMinutes, 0) / 60;

  const wonDeals = leadFunnel?.won ?? 0;
  const totalLeads = leadFunnel?.total ?? 0;

  const STATS = [
    { label: "Revenue Collected", value: money(totalPaid), sub: "paid invoices", color: "hsl(142,68%,52%)", icon: DollarSign },
    { label: "Outstanding", value: money(totalOutstanding), sub: `${money(totalOverdue)} overdue`, color: "hsl(35,90%,58%)", icon: Clock },
    { label: "Affiliate Earnings", value: money(affiliateStats?.totalEarningsCents ?? 0), sub: `${money(affiliateStats?.paidOutCents ?? 0)} paid out`, color: "hsl(262,83%,68%)", icon: Users },
    { label: "Won Deals", value: String(wonDeals), sub: `${totalLeads} total leads`, color: "hsl(220,90%,62%)", icon: Target },
    { label: "Billable Hours", value: `${billableHours.toFixed(1)}h`, sub: `${totalHours.toFixed(1)}h total logged`, color: "hsl(0,72%,58%)", icon: BarChart3 },
    { label: "Avg Deal Size", value: wonDeals > 0 ? money(Math.round(totalPaid / wonDeals)) : "—", sub: "from closed deals", color: "hsl(35,90%,58%)", icon: TrendingUp },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Revenue & Forecasting</h1>
        </div>
        <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>Pipeline health, revenue trends, and profitability at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STATS.map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}1a` }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue trend + pie */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-2 rounded-2xl p-4 md:p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Monthly Revenue (last 6 months)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="paid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142,68%,52%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142,68%,52%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(35,90%,58%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(35,90%,58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 20%)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(220 20% 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, ""]} contentStyle={{ background: "hsl(220 20% 10%)", border: "1px solid hsl(220 20% 20%)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="paid" stroke="hsl(142,68%,52%)" fill="url(#paid)" strokeWidth={2} name="Paid" />
              <Area type="monotone" dataKey="outstanding" stroke="hsl(35,90%,58%)" fill="url(#out)" strokeWidth={2} name="Outstanding" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Invoice Status</div>
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, ""]} contentStyle={{ background: "hsl(220 20% 10%)", border: "1px solid hsl(220 20% 20%)", borderRadius: 8 }} />
                <Legend formatter={(value) => <span style={{ color: "hsl(220 20% 70%)", fontSize: 12 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm" style={{ color: "var(--text-muted)" }}>No invoice data yet</div>
          )}
        </div>
      </div>

      {/* Lead funnel */}
      {leadFunnel && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Lead Conversion Funnel</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{leadFunnel.conversionRate}% conversion · {leadFunnel.total} total leads</div>
          </div>
          <div className="flex gap-2 items-end h-28">
            {leadFunnel.stages.filter((s) => s.count > 0).map((stage, i) => (
              <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>{stage.count}</div>
                <div
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${Math.max(8, (stage.count / (leadFunnel.total || 1)) * 88)}px`,
                    background: COLORS[i % COLORS.length],
                    opacity: 0.85,
                  }}
                />
                <div className="text-[9px] text-center" style={{ color: "var(--text-muted)" }}>{stage.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time tracking by project */}
      {timeByProject && timeByProject.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Hours Logged by Project</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeByProject.slice(0, 8).map((r) => ({ name: (r.projectName ?? "Unknown").slice(0, 20), hours: +(r.totalMinutes / 60).toFixed(1), billable: +(r.billableMinutes / 60).toFixed(1) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 20%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(220 20% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220 20% 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(220 20% 10%)", border: "1px solid hsl(220 20% 20%)", borderRadius: 8 }} />
              <Bar dataKey="hours" fill="hsl(220,90%,62%)" radius={[4, 4, 0, 0]} name="Total hours" />
              <Bar dataKey="billable" fill="hsl(142,68%,52%)" radius={[4, 4, 0, 0]} name="Billable hours" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Affiliate revenue section */}
      {(affiliateStats?.totalEarningsCents ?? 0) > 0 && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Affiliate Program Performance</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Affiliates", value: String(affiliateStats!.total) },
              { label: "Active Partners", value: String(affiliateStats!.approved) },
              { label: "Total Referrals", value: String(affiliateStats!.totalReferrals) },
              { label: "Commissions Earned", value: money(affiliateStats!.totalEarningsCents) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "var(--surface-elevated)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
