import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { apiKeys } from "../db/schema";

function generateApiKey(): { fullKey: string; prefix: string; hash: string; lastChars: string } {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const segments = Array.from({ length: 3 }, () =>
    Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  );
  const fullKey = `nf_${segments.join("_")}`;
  const prefix = fullKey.slice(0, 8);
  const lastChars = fullKey.slice(-4);

  // Simple hash (in production use bcrypt or similar)
  let hash = 0;
  for (let i = 0; i < fullKey.length; i++) {
    const char = fullKey.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  const hashStr = Math.abs(hash).toString(36);

  return { fullKey, prefix, hash: hashStr, lastChars };
}

export const apiKeysRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.apiKeys.findMany({
      orderBy: [desc(apiKeys.createdAt)],
      with: { creator: true },
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, input.id),
        with: { creator: true },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        permissions: z.string().default("read"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { fullKey, prefix, hash, lastChars } = generateApiKey();

      const [key] = await ctx.db
        .insert(apiKeys)
        .values({
          name: input.name,
          keyPrefix: prefix,
          keyHash: hash,
          keyLastChars: lastChars,
          permissions: input.permissions,
        })
        .returning();

      if (!key) throw new Error("Failed to create API key");

      // Return the full key only on creation
      return { ...key, fullKey };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        permissions: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [key] = await ctx.db
        .update(apiKeys)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning();
      return key;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(apiKeys).where(eq(apiKeys.id, input.id));
    }),

  recordUsage: publicProcedure
    .input(z.object({ keyPrefix: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.keyPrefix, input.keyPrefix));
    }),
});
