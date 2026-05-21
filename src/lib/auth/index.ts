import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, accounts, sessions, verificationTokens } from "@/server/db/schema";

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
        const email = (credentials?.email ?? "") as string;
        if (!email) return null;

        try {
          // Find existing user
          let user = await db.query.users.findFirst({ where: eq(users.email, email) });

          // Create new user if not found
          if (!user) {
            const id = crypto.randomUUID();
            const name = email.split("@")[0] ?? "User";
            const [created] = await db
              .insert(users)
              .values({ id, email, name, role: "admin" })
              .returning();
            user = created ?? null;
          }

          if (!user) return null;
          return { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId };
        } catch (err) {
          console.error("[auth] credentials authorize error:", err);
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
