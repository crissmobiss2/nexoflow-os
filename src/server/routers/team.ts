import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { teams, teamMembers, invitations, users } from "../db/schema";
import crypto from "crypto";

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 5,
  admin: 4,
  pm: 3,
  developer: 2,
  viewer: 1,
};

export const teamRouter = createTRPCRouter({
  // ─── Team CRUD ─────────────────────────────────────────────────────────────

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.teams.findMany({
      with: {
        members: { with: { user: true } },
        invitations: true,
      },
      orderBy: [desc(teams.createdAt)],
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.teams.findFirst({
        where: eq(teams.id, input.id),
        with: {
          members: { with: { user: true } },
          invitations: { with: { inviter: true } },
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [team] = await ctx.db.insert(teams).values(input).returning();
      return team;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [team] = await ctx.db
        .update(teams)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(teams.id, id))
        .returning();
      return team;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(teams).where(eq(teams.id, input.id));
    }),

  // ─── Members ──────────────────────────────────────────────────────────────

  listMembers: publicProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, input.teamId),
        with: { user: true },
        orderBy: [desc(teamMembers.createdAt)],
      });
    }),

  addMember: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string(),
        role: z.enum(["owner", "admin", "pm", "developer", "viewer"]).default("developer"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [member] = await ctx.db.insert(teamMembers).values(input).returning();
      return ctx.db.query.teamMembers.findFirst({
        where: eq(teamMembers.id, member.id),
        with: { user: true },
      });
    }),

  updateMemberRole: publicProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
        role: z.enum(["owner", "admin", "pm", "developer", "viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [member] = await ctx.db
        .update(teamMembers)
        .set({ role: input.role })
        .where(eq(teamMembers.id, input.memberId))
        .returning();
      return ctx.db.query.teamMembers.findFirst({
        where: eq(teamMembers.id, member.id),
        with: { user: true },
      });
    }),

  removeMember: publicProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(teamMembers).where(eq(teamMembers.id, input.memberId));
    }),

  // ─── Invitations ──────────────────────────────────────────────────────────

  listInvitations: publicProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.invitations.findMany({
        where: and(
          eq(invitations.teamId, input.teamId),
          eq(invitations.status, "pending"),
        ),
        with: { inviter: true },
        orderBy: [desc(invitations.createdAt)],
      });
    }),

  invite: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["owner", "admin", "pm", "developer", "viewer"]).default("developer"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await ctx.db
        .insert(invitations)
        .values({
          ...input,
          token,
          expiresAt,
        })
        .returning();

      return ctx.db.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
        with: { inviter: true, team: true },
      });
    }),

  cancelInvitation: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(invitations)
        .set({ status: "cancelled" })
        .where(eq(invitations.id, input.id));
    }),

  // ─── Users (for admin management) ─────────────────────────────────────────

  listUsers: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    });
  }),

  updateUserRole: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["owner", "admin", "pm", "developer", "viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning();
      return user;
    }),
});
