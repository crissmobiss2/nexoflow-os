import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { caseStudies } from "../db/schema";

const caseStudyInput = z.object({
  clientName: z.string().min(1),
  clientTitle: z.string().optional(),
  clientCompany: z.string().optional(),
  clientIndustry: z.string().optional(),
  avatarInitials: z.string().max(4).optional(),
  testimonial: z.string().min(1),
  metric1Label: z.string().optional(),
  metric1Value: z.string().optional(),
  metric2Label: z.string().optional(),
  metric2Value: z.string().optional(),
  metric3Label: z.string().optional(),
  metric3Value: z.string().optional(),
  linkedProjectId: z.string().uuid().optional().nullable(),
  linkedClientId: z.string().uuid().optional().nullable(),
});

export const caseStudiesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ publishedOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(caseStudies)
        .where(input?.publishedOnly ? eq(caseStudies.published, true) : undefined)
        .orderBy(asc(caseStudies.sortOrder), desc(caseStudies.createdAt));
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.caseStudies.findFirst({
        where: eq(caseStudies.id, input.id),
        with: { project: true, client: true },
      });
    }),

  create: protectedProcedure
    .input(caseStudyInput)
    .mutation(async ({ ctx, input }) => {
      const initials = input.avatarInitials ??
        input.clientName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const [cs] = await ctx.db
        .insert(caseStudies)
        .values({ ...input, avatarInitials: initials, published: false })
        .returning();
      return cs;
    }),

  update: protectedProcedure
    .input(caseStudyInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(caseStudies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(caseStudies.id, id))
        .returning();
      return updated;
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid(), published: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(caseStudies)
        .set({ published: input.published, updatedAt: new Date() })
        .where(eq(caseStudies.id, input.id))
        .returning();
      return updated;
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.map(({ id, sortOrder }) =>
          ctx.db.update(caseStudies).set({ sortOrder, updatedAt: new Date() }).where(eq(caseStudies.id, id))
        )
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(caseStudies).where(eq(caseStudies.id, input.id));
    }),
});
