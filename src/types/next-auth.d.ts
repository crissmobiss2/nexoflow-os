import { type DefaultSession } from "next-auth";
import { type DefaultUser } from "@auth/core/adapters";
import { type DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      teamId: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: string;
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    teamId?: string | null;
  }
}
