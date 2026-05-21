import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { affiliates, affiliateReferrals, leads } from "../db/schema";

function generateCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug}${rand}`;
}

export const affiliatesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "suspended"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(affiliates)
        .where(input?.status ? eq(affiliates.status, input.status) : undefined)
        .orderBy(desc(affiliates.createdAt));
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.affiliates.findFirst({
        where: eq(affiliates.id, input.id),
        with: { referrals: { orderBy: [desc(affiliateReferrals.createdAt)] } },
      });
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.affiliates.findFirst({
        where: and(eq(affiliates.referralCode, input.code), eq(affiliates.status, "approved")),
      });
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      website: z.string().optional(),
      promoMethod: z.string().optional(),
    }))
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
    .input(z.object({
      id: z.string().uuid(),
      tier: z.enum(["base", "silver", "gold"]).optional(),
      paypalEmail: z.string().email().optional(),
      notes: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected", "suspended"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(affiliates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(affiliates.id, id))
        .returning();
      return updated;
    }),

  createReferral: publicProcedure
    .input(z.object({
      affiliateCode: z.string(),
      leadId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const affiliate = await ctx.db.query.affiliates.findFirst({
        where: and(eq(affiliates.referralCode, input.affiliateCode), eq(affiliates.status, "approved")),
      });
      if (!affiliate) throw new Error("Invalid affiliate code");

      const commissionPct =
        affiliate.tier === "gold" ? 15 :
        affiliate.tier === "silver" ? 12 : 10;

      const [referral] = await ctx.db
        .insert(affiliateReferrals)
        .values({ affiliateId: affiliate.id, leadId: input.leadId, commissionPct })
        .returning();

      await ctx.db
        .update(affiliates)
        .set({ totalReferrals: sql`${affiliates.totalReferrals} + 1`, updatedAt: new Date() })
        .where(eq(affiliates.id, affiliate.id));

      return referral;
    }),

  markPaid: protectedProcedure
    .input(z.object({
      referralId: z.string().uuid(),
      projectValueCents: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.query.affiliateReferrals.findFirst({
        where: eq(affiliateReferrals.id, input.referralId),
      });
      if (!referral) throw new Error("Referral not found");

      const commissionCents = Math.round(input.projectValueCents * (referral.commissionPct / 100));

      const [updated] = await ctx.db
        .update(affiliateReferrals)
        .set({
          status: "paid",
          projectValueCents: input.projectValueCents,
          commissionCents,
          paidAt: new Date(),
        })
        .where(eq(affiliateReferrals.id, input.referralId))
        .returning();

      await ctx.db
        .update(affiliates)
        .set({
          totalEarningsCents: sql`${affiliates.totalEarningsCents} + ${commissionCents}`,
          paidOutCents: sql`${affiliates.paidOutCents} + ${commissionCents}`,
          updatedAt: new Date(),
        })
        .where(eq(affiliates.id, referral.affiliateId));

      return updated;
    }),

  stats: publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.select().from(affiliates);
    const refs = await ctx.db.select().from(affiliateReferrals);
    return {
      total: all.length,
      pending: all.filter((a) => a.status === "pending").length,
      approved: all.filter((a) => a.status === "approved").length,
      totalReferrals: refs.length,
      converted: refs.filter((r) => r.status === "converted" || r.status === "paid").length,
      totalEarningsCents: all.reduce((s, a) => s + a.totalEarningsCents, 0),
      paidOutCents: all.reduce((s, a) => s + a.paidOutCents, 0),
    };
  }),
});
