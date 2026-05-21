import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
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

        // Return immediately — DB sync happens post-sign-in via API
        return { id: email, email, name: email.split("@")[0] ?? "User", role: "admin" };
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
