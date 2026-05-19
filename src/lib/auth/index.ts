import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { db } from "@/server/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: "nf_user",
    accountsTable: "nf_account",
    sessionsTable: "nf_session",
    verificationTokensTable: "nf_verification_token",
  }),
  providers: [
    Resend({
      from: "nexoflow@resend.dev",
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as any).role ?? "viewer";
        // Attach teamId from user record for multi-tenant isolation
        session.user.teamId = (user as any).teamId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
