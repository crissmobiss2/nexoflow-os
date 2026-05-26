import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { proposalVersions, leads } from "../db/schema";

export const proposalsRouter = createTRPCRouter({
  listByLead: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.proposalVersions.findMany({
        where: (t, { eq }) => eq(t.leadId, input.leadId),
        orderBy: [desc(proposalVersions.version)],
      });
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.proposalVersions.findFirst({
        where: (t, { eq }) => eq(t.id, input.id),
        with: { lead: true },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      html: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.proposalVersions.findMany({
        where: (t, { eq }) => eq(t.leadId, input.leadId),
      });
      const version = existing.length + 1;
      const [proposal] = await ctx.db
        .insert(proposalVersions)
        .values({ leadId: input.leadId, html: input.html, version })
        .returning();
      return proposal;
    }),

  sign: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      signerName: z.string().min(1),
      signerEmail: z.string().email(),
      signerIp: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(proposalVersions)
        .set({
          signedAt: new Date(),
          signerName: input.signerName,
          signerEmail: input.signerEmail,
          signerIp: input.signerIp ?? null,
        })
        .where(eq(proposalVersions.id, input.id))
        .returning();
      return updated;
    }),
});
