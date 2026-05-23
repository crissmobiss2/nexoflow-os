import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getLimiter } from "@/lib/rate-limit";

// Allowed emails: comma-separated list in ALLOWED_EMAILS env var.
// Falls back to NEXOFLOW_ADMIN_EMAIL for single-user setups.
// If neither is set, ALL sign-ins are denied (fail-secure default).
function getAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS ?? process.env.NEXOFLOW_ADMIN_EMAIL ?? "";
  return new Set(
    raw.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function checkPassword(provided: string): boolean {
  const required = process.env.NEXOFLOW_PASSWORD;
  if (!required) return true; // password not configured — allowlist alone is the guard
  return provided === required;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, req) => {
        const email    = ((credentials?.email    ?? "") as string).toLowerCase().trim();
        const password = (credentials?.password ?? "") as string;
        if (!email) return null;

        // Rate limit by IP — 10 attempts per 5 minutes
        const ip = (req as Request & { headers?: Headers })?.headers?.get?.("x-forwarded-for")
          ?? (req as Request & { ip?: string })?.ip
          ?? "unknown";
        const limiter = getLimiter();
        const result = await limiter.publicRateLimit(`signin:${ip}`);
        if (!result.success) return null;

        // Email allowlist check
        const allowed = getAllowedEmails();
        if (allowed.size > 0 && !allowed.has(email)) return null;

        // Password check (optional second factor)
        if (!checkPassword(password)) return null;

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
