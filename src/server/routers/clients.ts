import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "../trpc";
import { clients } from "../db/schema";

const onboardingInput = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  region: z.string().optional(),
  businessDescription: z.string().optional(),
  targetCustomers: z.string().optional(),
  currentChallenges: z.string().optional(),
  existingTech: z.string().optional(),
  typicalBudget: z.string().optional(),
  urgency: z.string().optional(),
  decisionMakerRole: z.string().optional(),
  notes: z.string().optional(),
});

export const clientsRouter = createTRPCRouter({
  list: teamProcedure.query(async ({ ctx }) => {
    return ctx.db.query.clients.findMany({
      where: (t, { eq }) => eq(t.teamId, ctx.teamId),
      with: { projects: true },
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
  }),

  get: teamProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.clients.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, input.id), eq(t.teamId, ctx.teamId)),
        with: { projects: { with: { score: true } } },
      });
    }),

  create: teamProcedure
    .input(onboardingInput)
    .mutation(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .insert(clients)
        .values({
          ...input,
          teamId: ctx.teamId,
          email: input.email || null,
          onboardedAt: new Date(),
        })
        .returning();
      return client;
    }),

  update: teamProcedure
    .input(onboardingInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [client] = await ctx.db
        .update(clients)
        .set({ ...data, email: data.email || undefined, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning();
      return client;
    }),

  delete: teamProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(clients).where(eq(clients.id, input.id));
    }),
});
