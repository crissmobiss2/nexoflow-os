import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, accounts, sessions, verificationTokens, teams, teamMembers } from "@/server/db/schema";

async function findOrCreateUser(email: string) {
  let user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user) {
    const id = crypto.randomUUID();
    const name = email.split("@")[0] ?? "User";

    // Create a personal team for this user
    const [team] = await db.insert(teams).values({ name: `${name}'s Team` }).returning();
    if (!team) throw new Error("Failed to create team");

    const [created] = await db
      .insert(users)
      .values({ id, email, name, role: "admin", teamId: team.id })
      .returning();
    if (!created) throw new Error("Failed to create user");

    // Add user as team owner
    await db.insert(teamMembers).values({ teamId: team.id, userId: id, role: "owner" });

    user = created;
  }

  return user;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    ...(process.env.AUTH_RESEND_KEY ? [Resend({ from: "nexoflow@resend.dev" })] : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string;
        if (!email) return null;

        try {
          const user = await findOrCreateUser(email);
          return { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "admin";
        token.teamId = (user as any).teamId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "admin";
        session.user.teamId = (token.teamId as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
