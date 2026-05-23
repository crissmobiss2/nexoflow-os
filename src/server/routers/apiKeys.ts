import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { apiKeys } from "../db/schema";

function generateApiKey(): { fullKey: string; prefix: string; hash: string; lastChars: string } {
  // 32 cryptographically random bytes → base64url → always unique
  const secret = randomBytes(32).toString("base64url");
  const fullKey = `nf_${secret}`;
  const prefix = fullKey.slice(0, 8);
  const lastChars = fullKey.slice(-4);
  // SHA-256 — safe to store; can't be reversed to recover the original key
  const hash = createHash("sha256").update(fullKey).digest("hex");
  return { fullKey, prefix, hash, lastChars };
}

export function sha256ApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const apiKeysRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.apiKeys.findMany({
      orderBy: [desc(apiKeys.createdAt)],
      with: { creator: true },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, input.id),
        with: { creator: true },
      });
    }),

  create: protectedProcedure
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

  update: protectedProcedure
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

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(apiKeys).where(eq(apiKeys.id, input.id));
    }),

  recordUsage: protectedProcedure
    .input(z.object({ keyPrefix: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.keyPrefix, input.keyPrefix));
    }),
});
