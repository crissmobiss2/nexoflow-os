import { eq, desc, ilike, and, or } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { wikiPages, users } from "../db/schema";

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200)
    + "-" + Math.random().toString(36).slice(2, 6);
}

export const wikiRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(wikiPages.published, true)];
      if (input?.category) conditions.push(eq(wikiPages.category, input.category));
      if (input?.search) {
        conditions.push(or(
          ilike(wikiPages.title, `%${input.search}%`),
          ilike(wikiPages.content, `%${input.search}%`),
        )!);
      }
      return ctx.db
        .select({ page: wikiPages, authorName: users.name })
        .from(wikiPages)
        .leftJoin(users, eq(wikiPages.authorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(wikiPages.pinned), desc(wikiPages.updatedAt));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ page: wikiPages, authorName: users.name })
        .from(wikiPages)
        .leftJoin(users, eq(wikiPages.authorId, users.id))
        .where(eq(wikiPages.id, input.id));
      return row ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().default(""),
      category: z.string().optional(),
      tags: z.string().array().optional(),
      pinned: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [page] = await ctx.db
        .insert(wikiPages)
        .values({
          ...input,
          slug: slugify(input.title),
          authorId: ctx.session!.user.id,
        })
        .returning();
      return page;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      tags: z.string().array().optional(),
      pinned: z.boolean().optional(),
      published: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(wikiPages)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(wikiPages.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(wikiPages).where(eq(wikiPages.id, input.id));
      return { success: true };
    }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ category: wikiPages.category })
      .from(wikiPages)
      .where(and(eq(wikiPages.published, true)));
    return rows.map((r) => r.category).filter(Boolean) as string[];
  }),
});
