import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { industryProfiles } from "../db/schema";

const profileInput = z.object({
  slug: z.string().min(2).max(64),
  industry: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  commonPainPoints: z.array(z.string()).optional(),
  typicalOffers: z.array(z.string()).optional(),
  demoAngle: z.string().optional(),
  proposalAngle: z.string().optional(),
  suggestedFeatures: z.array(z.string()).optional(),
  brandPalette: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const industryProfilesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(industryProfiles)
      .orderBy(desc(industryProfiles.isActive), industryProfiles.industry);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.industryProfiles.findFirst({ where: eq(industryProfiles.id, input.id) });
    }),

  getByIndustry: protectedProcedure
    .input(z.object({ industry: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.industryProfiles.findFirst({
        where: and(eq(industryProfiles.industry, input.industry), eq(industryProfiles.isActive, true)),
      });
    }),

  create: protectedProcedure
    .input(profileInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(industryProfiles).values(input).returning();
      return created;
    }),

  update: protectedProcedure
    .input(profileInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(industryProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(industryProfiles.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(industryProfiles).where(eq(industryProfiles.id, input.id));
    }),
});
