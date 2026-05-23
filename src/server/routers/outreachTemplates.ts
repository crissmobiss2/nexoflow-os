import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { outreachTemplates } from "../db/schema";

const templateInput = z.object({
  name: z.string().min(1).max(255),
  channel: z.enum(["email", "whatsapp", "sms", "link"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  industry: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const outreachTemplatesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      channel: z.enum(["email", "whatsapp", "sms", "link"]).optional(),
      industry: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(outreachTemplates.isActive, true)];
      if (input?.channel) conditions.push(eq(outreachTemplates.channel, input.channel));
      if (input?.industry) conditions.push(eq(outreachTemplates.industry, input.industry));
      return ctx.db
        .select()
        .from(outreachTemplates)
        .where(and(...conditions))
        .orderBy(desc(outreachTemplates.useCount), desc(outreachTemplates.updatedAt));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.outreachTemplates.findFirst({ where: eq(outreachTemplates.id, input.id) });
    }),

  create: protectedProcedure
    .input(templateInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(outreachTemplates)
        .values({ ...input, ownerId: ctx.user?.id ?? null })
        .returning();
      return created;
    }),

  update: protectedProcedure
    .input(templateInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(outreachTemplates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(outreachTemplates.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(outreachTemplates).where(eq(outreachTemplates.id, input.id));
    }),

  recordUse: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(outreachTemplates)
        .set({
          useCount: sql`${outreachTemplates.useCount} + 1`,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(outreachTemplates.id, input.id));
    }),

  recordWin: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(outreachTemplates)
        .set({
          wonCount: sql`${outreachTemplates.wonCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(outreachTemplates.id, input.id));
    }),

  // Stats for the conversion feedback loop
  stats: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: outreachTemplates.id,
        name: outreachTemplates.name,
        channel: outreachTemplates.channel,
        industry: outreachTemplates.industry,
        useCount: outreachTemplates.useCount,
        wonCount: outreachTemplates.wonCount,
        winRate: sql<number>`CASE WHEN ${outreachTemplates.useCount} > 0 THEN (${outreachTemplates.wonCount}::float / ${outreachTemplates.useCount}) ELSE 0 END`,
      })
      .from(outreachTemplates)
      .where(eq(outreachTemplates.isActive, true))
      .orderBy(desc(sql`CASE WHEN ${outreachTemplates.useCount} > 0 THEN (${outreachTemplates.wonCount}::float / ${outreachTemplates.useCount}) ELSE 0 END`));
  }),
});
