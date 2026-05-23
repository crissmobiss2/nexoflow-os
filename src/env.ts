import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
    AUTH_SECRET: z.string().min(1),
    AUTH_RESEND_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_INBOUND_SECRET: z.string().optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    // Optional: path to local Obsidian vault for richer AI context.
    SECOND_BRAIN_PATH: z.string().optional(),
    OBSIDIAN_LOCAL_API_URL: z.string().url().optional(),
    // Scraper
    FIRECRAWL_API_KEY: z.string().optional(),
    // Twilio (SMS + WhatsApp)
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_SMS: z.string().optional(),
    TWILIO_FROM_WHATSAPP: z.string().optional(),
    // Vercel Blob (optional — falls back to DB text columns)
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    // Cron auth (Vercel sets CRON_SECRET automatically; we read it here too)
    CRON_SECRET: z.string().optional(),
    // Access control — ALLOWED_EMAILS is a comma-separated list of permitted emails.
    // NEXOFLOW_ADMIN_EMAIL is a single-email fallback for solo setups.
    // NEXOFLOW_PASSWORD adds a second factor: email + password required to sign in.
    ALLOWED_EMAILS: z.string().optional(),
    NEXOFLOW_ADMIN_EMAIL: z.string().email().optional(),
    NEXOFLOW_PASSWORD: z.string().min(8).optional(),
    // Admin endpoint secret (used by internal scripts only — never expose to clients)
    ADMIN_REGEN_SECRET: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_INBOUND_SECRET: process.env.RESEND_INBOUND_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    SECOND_BRAIN_PATH: process.env.SECOND_BRAIN_PATH,
    OBSIDIAN_LOCAL_API_URL: process.env.OBSIDIAN_LOCAL_API_URL,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_SMS: process.env.TWILIO_FROM_SMS,
    TWILIO_FROM_WHATSAPP: process.env.TWILIO_FROM_WHATSAPP,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    NEXOFLOW_ADMIN_EMAIL: process.env.NEXOFLOW_ADMIN_EMAIL,
    NEXOFLOW_PASSWORD: process.env.NEXOFLOW_PASSWORD,
    ADMIN_REGEN_SECRET: process.env.ADMIN_REGEN_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.VERCEL === "1",
});
