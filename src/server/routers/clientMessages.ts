import { eq, desc, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { clientMessages, clients } from "../db/schema";

export const clientMessagesRouter = createTRPCRouter({
  // Admin: list all messages for a client
  list: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(clientMessages)
        .where(eq(clientMessages.clientId, input.clientId))
        .orderBy(desc(clientMessages.createdAt));
    }),

  // Admin: send a message to client
  sendFromTeam: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      content: z.string().min(1),
      authorName: z.string().default("NexoFlow Team"),
    }))
    .mutation(async ({ ctx, input }) => {
      const [msg] = await ctx.db
        .insert(clientMessages)
        .values({
          clientId: input.clientId,
          direction: "from_team",
          authorName: input.authorName,
          content: input.content,
        })
        .returning();
      return msg;
    }),

  // Client portal: send message (public, validated by token)
  sendFromClient: publicProcedure
    .input(z.object({
      token: z.string(),
      content: z.string().min(1).max(2000),
      senderName: z.string().min(1).max(100).default("Client"),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.query.clients.findFirst({
        where: (t, { and, eq }) => and(eq(t.portalToken, input.token), eq(t.portalEnabled, true)),
      });
      if (!client) throw new Error("Invalid portal token");

      const [msg] = await ctx.db
        .insert(clientMessages)
        .values({
          clientId: client.id,
          direction: "from_client",
          authorName: input.senderName,
          content: input.content,
        })
        .returning();
      return msg;
    }),

  // Admin: mark messages read
  markRead: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(clientMessages)
        .set({ readAt: new Date() })
        .where(and(
          eq(clientMessages.clientId, input.clientId),
          eq(clientMessages.direction, "from_client"),
          isNull(clientMessages.readAt),
        ));
      return { success: true };
    }),

  // Admin: unread count across all clients
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ clientId: clientMessages.clientId })
      .from(clientMessages)
      .where(and(
        eq(clientMessages.direction, "from_client"),
        isNull(clientMessages.readAt),
      ));
    return rows.length;
  }),

  // Public: list messages by client token (for portal)
  listByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.query.clients.findFirst({
        where: (t, { and, eq }) => and(eq(t.portalToken, input.token), eq(t.portalEnabled, true)),
      });
      if (!client) return [];
      return ctx.db
        .select()
        .from(clientMessages)
        .where(eq(clientMessages.clientId, client.id))
        .orderBy(desc(clientMessages.createdAt));
    }),
});
