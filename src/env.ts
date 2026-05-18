import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
    GITHUB_TOKEN: z.string().optional(),
    GITHUB_ORG: z.string().optional(),
    VERCEL_TOKEN: z.string().optional(),
    VERCEL_TEAM_ID: z.string().optional(),
    SECOND_BRAIN_PATH: z.string().default("C:/NexoFlow Second-Brain/second-brain"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_ORG: process.env.GITHUB_ORG,
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
    SECOND_BRAIN_PATH: process.env.SECOND_BRAIN_PATH,
    NODE_ENV: process.env.NODE_ENV,
  },
});
