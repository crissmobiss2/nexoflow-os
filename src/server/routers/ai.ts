import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { aiConversations, aiMessages } from "../db/schema";

const AI_MODE_LABELS: Record<string, string> = {
  general:      "General Assistant",
  architect:    "Architect",
  tech_advisor: "Tech Advisor",
  code_review:  "Code Review",
  security:     "Security Audit",
  performance:  "Performance",
  estimator:    "Estimator",
  scope_writer: "Scope Writer",
};

export const aiRouter = createTRPCRouter({
  // List all conversations
  listConversations: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.aiConversations.findMany({
      orderBy: [desc(aiConversations.updatedAt)],
      with: {
        messages: {
          orderBy: [desc(aiMessages.createdAt)],
          limit: 1,
        },
      },
    });
  }),

  // Get a single conversation with all messages
  getConversation: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.aiConversations.findFirst({
        where: eq(aiConversations.id, input.id),
        with: {
          messages: {
            orderBy: [aiMessages.createdAt],
          },
        },
      });
    }),

  // Create a new conversation
  createConversation: publicProcedure
    .input(
      z.object({
        mode: z.enum(["general", "architect", "tech_advisor", "code_review", "security", "performance", "estimator", "scope_writer"]).default("general"),
        projectId: z.string().uuid().optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [convo] = await ctx.db
        .insert(aiConversations)
        .values({
          mode: input.mode,
          projectId: input.projectId,
          title: input.title ?? AI_MODE_LABELS[input.mode] ?? "New Chat",
        })
        .returning();
      return convo;
    }),

  // Update conversation title
  updateTitle: publicProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [convo] = await ctx.db
        .update(aiConversations)
        .set({ title: input.title, updatedAt: new Date() })
        .where(eq(aiConversations.id, input.id))
        .returning();
      return convo;
    }),

  // Delete a conversation
  deleteConversation: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(aiConversations).where(eq(aiConversations.id, input.id));
    }),

  // Save a message (called after streaming completes)
  saveMessage: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        contextSnippets: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [msg] = await ctx.db
        .insert(aiMessages)
        .values(input)
        .returning();

      // Update conversation updatedAt
      await ctx.db
        .update(aiConversations)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversations.id, input.conversationId));

      return msg;
    }),
});
