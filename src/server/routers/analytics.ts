import { count, sql, and, isNotNull, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { projects, clients, aiConversations, opportunityScores, leads, invoices } from "../db/schema";

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
});
