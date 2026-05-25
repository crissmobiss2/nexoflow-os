import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import {
  affiliates,
  affiliateReferrals,
  affiliateClicks,
  affiliatePayouts,
  leads,
  leadCalls,
} from "../db/schema";

function generateCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug}${rand}`;
}

function commissionPct(tier: string): number {
  if (tier === "gold") return 15;
  if (tier === "silver") return 12;
  return 10;
}

export const affiliatesRouter = createTRPCRouter({

  // ─── Queries ──────────────────────────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({ status: z.enum(["pending", "approved", "rejected", "suspended"]).optional() }).optional(),
    )
    .query(async ({ ctx, input }) => {
      // Pull affiliates + click counts + referral counts in one go
      const rows = await ctx.db
        .select({
          affiliate: affiliates,
          clickCount: sql<number>`(
            SELECT COUNT(*)::int FROM nf_affiliate_clicks c
            WHERE c.affiliate_id = ${affiliates.id}
          )`,
          pendingReferrals: sql<number>`(
            SELECT COUNT(*)::int FROM nf_affiliate_referrals r
            WHERE r.affiliate_id = ${affiliates.id} AND r.status = 'pending'
          )`,
          convertedReferrals: sql<number>`(
            SELECT COUNT(*)::int FROM nf_affiliate_referrals r
            WHERE r.affiliate_id = ${affiliates.id}
              AND r.status IN ('converted', 'paid')
          )`,
        })
        .from(affiliates)
        .where(input?.status ? eq(affiliates.status, input.status) : undefined)
        .orderBy(desc(affiliates.createdAt));

      return rows.map((r) => ({ ...r.affiliate, clickCount: r.clickCount, pendingReferrals: r.pendingReferrals, convertedReferrals: r.convertedReferrals }));
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.affiliates.findFirst({
        where: and(
          eq(affiliates.referralCode, input.code),
          eq(affiliates.status, "approved"),
        ),
      });
    }),

  // Full journey for an affiliate: leads → calls → commissions → payouts
  getJourney: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const affiliate = await ctx.db.query.affiliates.findFirst({
        where: eq(affiliates.referralCode, input.code),
      });
      if (!affiliate) return null;

      // All leads attributed to this affiliate
      const affiliateLeads = await ctx.db.query.leads.findMany({
        where: eq(leads.affiliateCode, input.code),
        orderBy: [desc(leads.createdAt)],
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          industry: true,
          status: true,
          wonValueCents: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          calls: {
            orderBy: [desc(leadCalls.createdAt)],
            columns: {
              id: true,
              scheduledAt: true,
              completedAt: true,
              outcome: true,
              durationMinutes: true,
              bookingRef: true,
            },
          },
        },
      });

      // Referral records for all these leads
      const leadIds = affiliateLeads.map((l) => l.id);
      const referralRecords =
        leadIds.length > 0
          ? await ctx.db
              .select()
              .from(affiliateReferrals)
              .where(
                and(
                  eq(affiliateReferrals.affiliateId, affiliate.id),
                  inArray(affiliateReferrals.leadId, leadIds),
                ),
              )
          : [];
      const referralByLeadId = Object.fromEntries(
        referralRecords.map((r) => [r.leadId!, r]),
      );

      // Click stats
      const [clickStats] = await ctx.db
        .select({
          total: sql<number>`COUNT(*)::int`,
          converted: sql<number>`SUM(CASE WHEN converted THEN 1 ELSE 0 END)::int`,
          countries: sql<string[]>`array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL)`,
        })
        .from(affiliateClicks)
        .where(eq(affiliateClicks.affiliateId, affiliate.id));

      // Payouts
      const payoutRows = await ctx.db
        .select()
        .from(affiliatePayouts)
        .where(eq(affiliatePayouts.affiliateId, affiliate.id))
        .orderBy(desc(affiliatePayouts.createdAt));

      // Tier thresholds: silver = 5 referrals, gold = 20
      const wonCount = affiliateLeads.filter((l) => l.status === "won").length;
      const nextTier =
        affiliate.tier === "gold" ? null :
        affiliate.tier === "silver" ? { name: "gold", pct: "15%", target: 20, current: wonCount } :
        { name: "silver", pct: "12%", target: 5, current: wonCount };

      // Assemble lead pipeline with journey stages
      const pipeline = affiliateLeads.map((lead) => {
        const referral = referralByLeadId[lead.id];
        const latestCall = lead.calls[0] ?? null;
        const callBooked = !!latestCall?.scheduledAt;
        const callCompleted = !!latestCall?.completedAt;
        const dealWon = lead.status === "won";

        return {
          lead,
          callBooked,
          callScheduledAt: latestCall?.scheduledAt ?? null,
          callCompletedAt: latestCall?.completedAt ?? null,
          callOutcome: latestCall?.outcome ?? null,
          callDurationMinutes: latestCall?.durationMinutes ?? null,
          dealWon,
          wonValueCents: lead.wonValueCents ?? 0,
          referral: referral ?? null,
          commissionCents: referral?.commissionCents ?? 0,
          commissionStatus: referral?.status ?? null,
        };
      });

      return {
        affiliate,
        pipeline,
        clickStats: {
          total: clickStats?.total ?? 0,
          converted: clickStats?.converted ?? 0,
          countries: clickStats?.countries ?? [],
        },
        payouts: payoutRows,
        nextTier,
        summary: {
          totalLeads: pipeline.length,
          callsBooked: pipeline.filter((p) => p.callBooked).length,
          callsCompleted: pipeline.filter((p) => p.callCompletedAt).length,
          dealsWon: pipeline.filter((p) => p.dealWon).length,
          pendingCommissionCents: pipeline
            .filter((p) => p.referral?.status === "pending" || (p.dealWon && !p.referral))
            .reduce((s, p) => s + p.commissionCents, 0),
          paidCommissionCents: affiliate.paidOutCents,
          totalEarnedCents: affiliate.totalEarningsCents,
        },
      };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.select().from(affiliates);
    const refs = await ctx.db.select().from(affiliateReferrals);
    const [clickRow] = await ctx.db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(affiliateClicks);
    return {
      total: all.length,
      pending: all.filter((a) => a.status === "pending").length,
      approved: all.filter((a) => a.status === "approved").length,
      totalReferrals: refs.length,
      converted: refs.filter((r) => r.status === "converted" || r.status === "paid").length,
      totalEarningsCents: all.reduce((s, a) => s + a.totalEarningsCents, 0),
      paidOutCents: all.reduce((s, a) => s + a.paidOutCents, 0),
      totalClicks: clickRow?.total ?? 0,
    };
  }),

  // ─── Mutations ────────────────────────────────────────────────────────────

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        website: z.string().optional(),
        promoMethod: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const referralCode = generateCode(input.name);
      const [affiliate] = await ctx.db
        .insert(affiliates)
        .values({ ...input, referralCode, status: "pending" })
        .returning();
      return affiliate;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(affiliates)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(affiliates.id, input.id))
        .returning();
      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(affiliates)
        .set({ status: "rejected", notes: input.notes ?? null, updatedAt: new Date() })
        .where(eq(affiliates.id, input.id))
        .returning();
      return updated;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tier: z.enum(["base", "silver", "gold"]).optional(),
        paypalEmail: z.string().email().optional(),
        notes: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "suspended"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Auto-update commission rate when tier changes
      const extra: Record<string, number> = {};
      if (data.tier) extra.commissionRate = commissionPct(data.tier);
      const [updated] = await ctx.db
        .update(affiliates)
        .set({ ...data, ...extra, updatedAt: new Date() })
        .where(eq(affiliates.id, id))
        .returning();
      return updated;
    }),

  // Christopher logs when an affiliate's lead signs a project
  logConversion: protectedProcedure
    .input(
      z.object({
        affiliateId: z.string().uuid(),
        leadId: z.string().uuid(),
        projectValueCents: z.number().int().min(0),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const affiliate = await ctx.db.query.affiliates.findFirst({
        where: eq(affiliates.id, input.affiliateId),
      });
      if (!affiliate) throw new Error("Affiliate not found");

      const pct = commissionPct(affiliate.tier);
      const commissionCents = Math.round(input.projectValueCents * (pct / 100));

      // Upsert the referral record
      const existing = await ctx.db.query.affiliateReferrals.findFirst({
        where: and(
          eq(affiliateReferrals.affiliateId, input.affiliateId),
          eq(affiliateReferrals.leadId, input.leadId),
        ),
      });

      let referral;
      if (existing) {
        [referral] = await ctx.db
          .update(affiliateReferrals)
          .set({
            status: "converted",
            projectValueCents: input.projectValueCents,
            commissionCents,
            commissionPct: pct,
          })
          .where(eq(affiliateReferrals.id, existing.id))
          .returning();
      } else {
        [referral] = await ctx.db
          .insert(affiliateReferrals)
          .values({
            affiliateId: input.affiliateId,
            leadId: input.leadId,
            commissionPct: pct,
            projectValueCents: input.projectValueCents,
            commissionCents,
            status: "converted",
          })
          .returning();

        // Bump referral count + total earnings
        await ctx.db
          .update(affiliates)
          .set({
            totalReferrals: sql`${affiliates.totalReferrals} + 1`,
            totalEarningsCents: sql`${affiliates.totalEarningsCents} + ${commissionCents}`,
            updatedAt: new Date(),
          })
          .where(eq(affiliates.id, input.affiliateId));
      }

      // Mark the corresponding click as converted if one exists
      await ctx.db
        .update(affiliateClicks)
        .set({ converted: true })
        .where(
          and(
            eq(affiliateClicks.affiliateId, input.affiliateId),
            eq(affiliateClicks.converted, false),
          ),
        );

      return referral;
    }),

  // Mark an individual referral as paid
  markReferralPaid: protectedProcedure
    .input(
      z.object({
        referralId: z.string().uuid(),
        projectValueCents: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.query.affiliateReferrals.findFirst({
        where: eq(affiliateReferrals.id, input.referralId),
      });
      if (!referral) throw new Error("Referral not found");

      const valueCents = input.projectValueCents ?? referral.projectValueCents ?? 0;
      const commissionCents = Math.round(valueCents * (referral.commissionPct / 100));

      const [updated] = await ctx.db
        .update(affiliateReferrals)
        .set({
          status: "paid",
          projectValueCents: valueCents,
          commissionCents,
          paidAt: new Date(),
        })
        .where(eq(affiliateReferrals.id, input.referralId))
        .returning();

      await ctx.db
        .update(affiliates)
        .set({
          paidOutCents: sql`${affiliates.paidOutCents} + ${commissionCents}`,
          updatedAt: new Date(),
        })
        .where(eq(affiliates.id, referral.affiliateId));

      return updated;
    }),

  // Process a bulk payout to an affiliate
  processPayout: protectedProcedure
    .input(
      z.object({
        affiliateId: z.string().uuid(),
        amountCents: z.number().int().min(1),
        method: z.enum(["bank_transfer", "paypal", "wise", "stripe"]),
        reference: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [payout] = await ctx.db
        .insert(affiliatePayouts)
        .values({
          affiliateId: input.affiliateId,
          amountCents: input.amountCents,
          method: input.method,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          status: "completed",
          completedAt: new Date(),
        })
        .returning();

      await ctx.db
        .update(affiliates)
        .set({
          paidOutCents: sql`${affiliates.paidOutCents} + ${input.amountCents}`,
          updatedAt: new Date(),
        })
        .where(eq(affiliates.id, input.affiliateId));

      return payout;
    }),

  // Legacy: kept for backward compat
  createReferral: publicProcedure
    .input(z.object({ affiliateCode: z.string(), leadId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const affiliate = await ctx.db.query.affiliates.findFirst({
        where: and(
          eq(affiliates.referralCode, input.affiliateCode),
          eq(affiliates.status, "approved"),
        ),
      });
      if (!affiliate) throw new Error("Invalid affiliate code");

      const pct = commissionPct(affiliate.tier);
      const [referral] = await ctx.db
        .insert(affiliateReferrals)
        .values({ affiliateId: affiliate.id, leadId: input.leadId, commissionPct: pct })
        .returning();

      await ctx.db
        .update(affiliates)
        .set({ totalReferrals: sql`${affiliates.totalReferrals} + 1`, updatedAt: new Date() })
        .where(eq(affiliates.id, affiliate.id));

      return referral;
    }),
});
