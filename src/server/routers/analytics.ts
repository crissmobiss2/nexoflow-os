import { count, sql, and, isNotNull, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { projects, clients, aiConversations, opportunityScores, leads, invoices } from "../db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "not_configured");

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const dateFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.string().optional(),
});

function buildDateWhere(
  dateFrom?: string,
  dateTo?: string,
): ReturnType<typeof and> | undefined {
  const conditions = [];
  if (dateFrom) {
    conditions.push(gte(projects.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(projects.createdAt, new Date(dateTo)));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_LABEL: Record<string, string> = {
  brief: "Brief",
  scored: "Scored",
  scoped: "Scoped",
  architected: "Architected",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
};

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

// ─── Router ───────────────────────────────────────────────────────────────────

export const analyticsRouter = createTRPCRouter({
  // Overview metrics
  overview: publicProcedure
    .input(dateFilterSchema)
    .query(async ({ ctx, input }) => {
      const dateWhere = buildDateWhere(input.dateFrom, input.dateTo);

      const projectConditions = dateWhere ? [dateWhere] : [];
      if (input.type) {
        projectConditions.push(
          inArray(projects.projectType, input.type.split(",") as any),
        );
      }
      const projectWhere =
        projectConditions.length > 0 ? and(...projectConditions) : undefined;

      const [totalClients] = await ctx.db
        .select({ value: count() })
        .from(clients);

      const [totalProjects] = await ctx.db
        .select({ value: count() })
        .from(projects)
        .where(projectWhere);

      const [totalConversations] = await ctx.db
        .select({ value: count() })
        .from(aiConversations);

      // Win rate
      const winRateRaw = await ctx.db
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

      // Budget data
      const budgetRows = await ctx.db
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
              parsedBudgets.reduce((sum, b) => sum + b.low, 0) /
                parsedBudgets.length,
            )
          : 0;

      const pipelineValue = parsedBudgets
        .filter((b) => b.status !== "archived")
        .reduce((sum, b) => sum + b.low, 0);

      return {
        totalClients: totalClients?.value ?? 0,
        totalProjects: totalProjects?.value ?? 0,
        winRate,
        winRateWon: winRateData.won,
        winRateTotal: winRateData.total,
        avgDealValue,
        pipelineValue,
        parsedBudgetCount: parsedBudgets.length,
        totalConversations: totalConversations?.value ?? 0,
      };
    }),

  // Projects by status
  byStatus: publicProcedure
    .input(dateFilterSchema)
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof and>[] = [];
      if (input.dateFrom) {
        conditions.push(gte(projects.createdAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(projects.createdAt, new Date(input.dateTo)));
      }
      if (input.type) {
        conditions.push(
          inArray(projects.projectType, input.type.split(",") as any),
        );
      }

      const rows = await ctx.db
        .select({
          status: projects.status,
          value: count(),
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.status)
        .orderBy(projects.status);

      const statusMap = new Map(rows.map((r) => [r.status, r.value]));
      return Object.keys(STATUS_LABEL).map((s) => ({
        label: STATUS_LABEL[s] ?? s,
        value: statusMap.get(s as any) ?? 0,
        color: STATUS_COLORS[s] ?? "hsl(220, 12%, 50%)",
        statusKey: s,
      }));
    }),

  // Projects by type
  byType: publicProcedure
    .input(dateFilterSchema)
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof and>[] = [];
      if (input.dateFrom) {
        conditions.push(gte(projects.createdAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(projects.createdAt, new Date(input.dateTo)));
      }

      const rows = await ctx.db
        .select({
          type: projects.projectType,
          value: count(),
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.projectType)
        .orderBy(projects.projectType);

      return rows
        .map((r) => ({
          label: TYPE_LABEL[r.type] ?? r.type,
          value: r.value,
          color: TYPE_COLORS[r.type] ?? "hsl(220, 90%, 62%)",
          typeKey: r.type,
        }))
        .sort((a, b) => b.value - a.value);
    }),

  // Revenue forecast by month
  revenue: publicProcedure
    .input(dateFilterSchema)
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof and>[] = [
        isNotNull(projects.budgetRange),
      ];
      if (input.dateFrom) {
        conditions.push(gte(projects.createdAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(projects.createdAt, new Date(input.dateTo)));
      }
      if (input.type) {
        conditions.push(
          inArray(projects.projectType, input.type.split(",") as any),
        );
      }

      const rows = await ctx.db
        .select({
          month: sql<string>`to_char(${projects.createdAt}, 'YYYY-MM')`,
          budgetRange: projects.budgetRange,
        })
        .from(projects)
        .where(and(...conditions))
        .orderBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`);

      const byMonth = new Map<string, number>();
      for (const r of rows) {
        const low = parseBudgetLow(r.budgetRange);
        if (low !== null) {
          byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + low);
        }
      }
      return Array.from(byMonth.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }),

  // Lead conversion funnel
  leadFunnel: publicProcedure
    .query(async ({ ctx }) => {
      const STAGES = ["new", "reviewing", "demo_queued", "demo_generated", "sent", "replied", "won", "lost"] as const;
      const STAGE_LABELS: Record<string, string> = {
        new: "New", reviewing: "Reviewing", demo_queued: "Demo Queued",
        demo_generated: "Demo Ready", sent: "Sent", replied: "Replied",
        won: "Won", lost: "Lost",
      };

      const rows = await ctx.db
        .select({ status: leads.status, count: count() })
        .from(leads)
        .groupBy(leads.status);

      const byStatus = new Map(rows.map((r) => [r.status, r.count]));
      const total = rows.reduce((s, r) => s + r.count, 0);

      return {
        total,
        stages: STAGES.map((s) => ({
          key: s,
          label: STAGE_LABELS[s] ?? s,
          count: byStatus.get(s) ?? 0,
          pct: total > 0 ? Math.round(((byStatus.get(s) ?? 0) / total) * 100) : 0,
        })),
        won: byStatus.get("won") ?? 0,
        lost: byStatus.get("lost") ?? 0,
        conversionRate: total > 0 ? Math.round(((byStatus.get("won") ?? 0) / total) * 100) : 0,
        demoConversionRate: (byStatus.get("demo_generated") ?? 0) > 0
          ? Math.round(((byStatus.get("won") ?? 0) / (byStatus.get("demo_generated") ?? 1)) * 100)
          : 0,
      };
    }),

  // Lead source attribution
  leadSources: publicProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ source: leads.source, sourceDetail: leads.sourceDetail, count: count() })
        .from(leads)
        .groupBy(leads.source, leads.sourceDetail);

      const total = rows.reduce((s, r) => s + r.count, 0);
      return {
        total,
        bySource: rows.map((r) => ({
          source: r.sourceDetail ?? r.source,
          count: r.count,
          pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
        })).sort((a, b) => b.count - a.count),
      };
    }),

  // Revenue pipeline (invoice totals by status)
  revenuePipeline: publicProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ status: invoices.status, total: sql<number>`sum(${invoices.total})` })
        .from(invoices)
        .groupBy(invoices.status);

      const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.total ?? 0)]));
      return {
        draft: byStatus.draft ?? 0,
        sent: byStatus.sent ?? 0,
        paid: byStatus.paid ?? 0,
        overdue: byStatus.overdue ?? 0,
        totalPipeline: (byStatus.draft ?? 0) + (byStatus.sent ?? 0),
        totalCollected: byStatus.paid ?? 0,
      };
    }),

  // Project volume over time
  volume: publicProcedure
    .input(dateFilterSchema)
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof and>[] = [];
      if (input.dateFrom) {
        conditions.push(gte(projects.createdAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(projects.createdAt, new Date(input.dateTo)));
      }
      if (input.type) {
        conditions.push(
          inArray(projects.projectType, input.type.split(",") as any),
        );
      }

      const rows = await ctx.db
        .select({
          month: sql<string>`to_char(${projects.createdAt}, 'YYYY-MM')`,
          value: count(),
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`);

      return rows.map((r) => ({ month: r.month, value: r.value }));
    }),

  // Win/Loss AI insights
  winLossInsights: publicProcedure.query(async ({ ctx }) => {
    const wonLeads = await ctx.db
      .select({ company: leads.company, industry: leads.industry, source: leads.source,
        companySize: leads.companySize, jobTitle: leads.jobTitle, aiScore: leads.aiScore })
      .from(leads).where(sql`${leads.status} = 'won'`).limit(20);
    const lostLeads = await ctx.db
      .select({ company: leads.company, industry: leads.industry, source: leads.source,
        companySize: leads.companySize, jobTitle: leads.jobTitle, aiScore: leads.aiScore })
      .from(leads).where(sql`${leads.status} = 'lost'`).limit(20);

    if (wonLeads.length + lostLeads.length < 2) {
      return { summary: "Not enough data yet. Mark leads as won or lost to generate insights.", patterns: [] };
    }

    const prompt = `Analyze these won vs lost leads and identify 3-5 key patterns.

WON LEADS (${wonLeads.length}):
${wonLeads.map((l) => `- ${l.company ?? "?"} | ${l.industry ?? "?"} | ${l.jobTitle ?? "?"} | Size: ${l.companySize ?? "?"} | Source: ${l.source} | Score: ${l.aiScore ?? "?"}`).join("\n")}

LOST LEADS (${lostLeads.length}):
${lostLeads.map((l) => `- ${l.company ?? "?"} | ${l.industry ?? "?"} | ${l.jobTitle ?? "?"} | Size: ${l.companySize ?? "?"} | Source: ${l.source} | Score: ${l.aiScore ?? "?"}`).join("\n")}

Return ONLY valid JSON: { "summary": "2-3 sentence overall insight", "patterns": [{ "title": string, "insight": string, "action": string }] }`;

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "{}";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    try {
      return JSON.parse(text) as { summary: string; patterns: { title: string; insight: string; action: string }[] };
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]) as { summary: string; patterns: { title: string; insight: string; action: string }[] }; } catch { /* fall through */ }
      }
      return { summary: "Could not parse AI response.", patterns: [] };
    }
  }),

  // Weekly AI Business Report
  generateWeeklyReport: publicProcedure
    .input(z.object({ email: z.string().email().optional() }))
    .mutation(async ({ ctx, input }) => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const [newLeads, wonLeads, paidInvoicesRaw, totalLeadsRaw] = await Promise.all([
        ctx.db.select({ count: count() }).from(leads).where(gte(leads.createdAt, oneWeekAgo)),
        ctx.db.select({ count: count() }).from(leads).where(sql`${leads.status} = 'won' AND ${leads.updatedAt} >= ${oneWeekAgo.toISOString()}`),
        ctx.db.select({ total: sql<number>`sum(${invoices.total})`, count: count() }).from(invoices)
          .where(sql`${invoices.status} = 'paid' AND ${invoices.updatedAt} >= ${oneWeekAgo.toISOString()}`),
        ctx.db.select({ count: count() }).from(leads),
      ]);

      const newLeadsCount = newLeads[0]?.count ?? 0;
      const wonCount = wonLeads[0]?.count ?? 0;
      const invoicePaidAmount = Number(paidInvoicesRaw[0]?.total ?? 0);
      const invoicePaidCount = paidInvoicesRaw[0]?.count ?? 0;
      const totalLeads = totalLeadsRaw[0]?.count ?? 0;
      const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

      const prompt = `Generate a brief weekly business report for NexoFlow (software agency).

Stats this week:
- New leads: ${newLeadsCount}
- Deals won: ${wonCount}
- Invoices paid: ${invoicePaidCount} (£${(invoicePaidAmount / 100).toFixed(2)})
- Overall conversion rate: ${conversionRate}%

Write a professional but friendly 3-paragraph weekly summary with:
1. Performance overview
2. Key wins and areas of concern
3. One strategic recommendation for next week

Keep it under 200 words.`;

      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      const reportText = resp.content[0]?.type === "text" ? resp.content[0].text : "Report generation failed.";

      const recipientEmail = input.email ?? process.env.REPORT_EMAIL ?? "crissmobiss@gmail.com";
      let emailSent = false;
      try {
        await resend.emails.send({
          from: "NexoFlow Reports <reports@nexoflow.tech>",
          to: [recipientEmail],
          subject: `NexoFlow Weekly Report — w/e ${new Date().toLocaleDateString("en-GB")}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#7c5cbf">NexoFlow Weekly Report</h2>
<p style="color:#666;font-size:13px">Week ending ${new Date().toLocaleDateString("en-GB")}</p>
<hr style="border-color:#eee">
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;background:#f9f9f9;border-radius:4px"><strong>New Leads</strong></td><td style="padding:8px;text-align:right;font-weight:bold">${newLeadsCount}</td></tr>
<tr><td style="padding:8px"><strong>Deals Won</strong></td><td style="padding:8px;text-align:right;color:#22c55e;font-weight:bold">${wonCount}</td></tr>
<tr><td style="padding:8px;background:#f9f9f9"><strong>Revenue Collected</strong></td><td style="padding:8px;text-align:right;font-weight:bold">£${(invoicePaidAmount / 100).toFixed(2)}</td></tr>
<tr><td style="padding:8px"><strong>Conversion Rate</strong></td><td style="padding:8px;text-align:right;font-weight:bold">${conversionRate}%</td></tr>
</table>
<hr style="border-color:#eee">
<h3 style="color:#333">AI Analysis</h3>
${reportText.split("\n").map((p) => p ? `<p style="color:#444;line-height:1.6">${p}</p>` : "").join("")}
<hr style="border-color:#eee">
<p style="color:#999;font-size:12px">NexoFlow OS · <a href="https://nexoflow-os-crissmobiss2s-projects.vercel.app">Open Dashboard</a></p>
</div>`,
        });
        emailSent = true;
      } catch { /* best-effort */ }

      return {
        stats: { newLeadsCount, wonCount, invoicePaidAmount, invoicePaidCount, conversionRate },
        report: reportText,
        emailSent,
        sentTo: recipientEmail,
      };
    }),
});
