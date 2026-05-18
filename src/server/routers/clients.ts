import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { clients } from "../db/schema";

export const clientsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.clients.findMany({
      with: { projects: true },
      orderBy: (c, { asc }) => [asc(c.name)],
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.clients.findFirst({
        where: eq(clients.id, input.id),
        with: { projects: true },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [client] = await ctx.db.insert(clients).values(input).returning();
      return client;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [client] = await ctx.db
        .update(clients)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning();
      return client;
    }),
});
