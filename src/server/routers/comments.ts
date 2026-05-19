import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, teamProcedure, publicProcedure } from "../trpc";
import { comments } from "../db/schema";
import { createNotification } from "@/lib/notifications";

export const commentsRouter = createTRPCRouter({
  list: teamProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.comments.findMany({
        where: (t, { and, eq }) => and(eq(t.projectId, input.projectId), eq(t.teamId, ctx.teamId)),
        orderBy: [desc(comments.createdAt)],
      });
    }),

  create: teamProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        authorId: z.string().optional().nullable(),
        authorName: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db.insert(comments).values({ ...input, teamId: ctx.teamId }).returning();
      try {
        createNotification({
          userId: "system",
          type: "comment",
          title: `New comment by ${input.authorName}`,
          message: input.content.length > 100 ? input.content.slice(0, 100) + "..." : input.content,
          link: `/projects/${input.projectId}`,
        });
      } catch { /* best-effort */ }
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
