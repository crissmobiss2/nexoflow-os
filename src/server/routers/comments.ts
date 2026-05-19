import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { comments } from "../db/schema";

export const commentsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.comments.findMany({
        where: eq(comments.projectId, input.projectId),
        orderBy: [desc(comments.createdAt)],
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        authorId: z.string().optional().nullable(),
        authorName: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db.insert(comments).values(input).returning();
      return comment;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, content } = input;
      const [comment] = await ctx.db
        .update(comments)
        .set({ content, updatedAt: new Date() })
        .where(eq(comments.id, id))
        .returning();
      return comment;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(comments).where(eq(comments.id, input.id));
    }),
});
