/**
 * ensure-schema.ts
 *
 * Runs idempotent SQL to add any missing columns/enums/tables that
 * drizzle-kit push misses due to interactive-mode timeouts on Vercel.
 *
 * Safe to run multiple times — every statement uses IF NOT EXISTS / DO blocks.
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function run(label: string, query: string) {
  try {
    await sql.unsafe(query);
    console.log(`✓ ${label}`);
  } catch (err: any) {
    // Ignore "already exists" errors
    if (err?.code === "42710" || err?.code === "42701" || err?.code === "42P07") {
      console.log(`  (already exists) ${label}`);
    } else {
      console.error(`✗ ${label}:`, err?.message ?? err);
    }
  }
}

async function main() {
  console.log("── NexoFlow schema sync ──────────────────────────────");

  // ── Enum types ────────────────────────────────────────────────────────────
  await run("enum nf_lead_status", `
    DO $$ BEGIN
      CREATE TYPE nf_lead_status AS ENUM (
        'new','reviewing','demo_queued','demo_generated',
        'sent','replied','won','lost','archived'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await run("enum nf_lead_source", `
    DO $$ BEGIN
      CREATE TYPE nf_lead_source AS ENUM (
        'csv_import','manual','api','web_scraper'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await run("enum nf_outreach_channel", `
    DO $$ BEGIN
      CREATE TYPE nf_outreach_channel AS ENUM (
        'email','whatsapp','sms','link'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await run("enum nf_notification_type", `
    DO $$ BEGIN
      CREATE TYPE nf_notification_type AS ENUM (
        'project_status','sprint_task','comment','invoice',
        'team_invite','ai_conversation','client_onboarding'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // ── pgvector extension ────────────────────────────────────────────────────────
  await run("extension vector", `CREATE EXTENSION IF NOT EXISTS vector`);

  // ── nf_knowledge_snippets — add embedding column if missing ──────────────────
  await run("nf_knowledge_snippets.embedding", `
    ALTER TABLE nf_knowledge_snippets
      ADD COLUMN IF NOT EXISTS embedding vector(1024)
  `);
  await run("nf_snippets_embedding_idx", `
    CREATE INDEX IF NOT EXISTS nf_snippets_embedding_idx
      ON nf_knowledge_snippets
      USING hnsw (embedding vector_cosine_ops)
  `);

  // ── nf_api_keys — add missing columns ────────────────────────────────────
  await run("nf_api_keys.key_prefix",    `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(8) NOT NULL DEFAULT ''`);
  await run("nf_api_keys.key_hash",      `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT NOT NULL DEFAULT ''`);
  await run("nf_api_keys.key_last_chars",`ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS key_last_chars VARCHAR(4) NOT NULL DEFAULT ''`);
  await run("nf_api_keys.created_by",    `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES nf_users(id) ON DELETE SET NULL`);
  await run("nf_api_keys.last_used_at",  `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ`);
  await run("nf_api_keys.expires_at",    `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await run("nf_api_keys.is_active",     `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);
  await run("nf_api_keys index",         `CREATE INDEX IF NOT EXISTS nf_api_keys_prefix_idx ON nf_api_keys (key_prefix)`);

  // ── nf_leads table ────────────────────────────────────────────────────────
  await run("nf_leads table", `
    CREATE TABLE IF NOT EXISTS nf_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      linkedin VARCHAR(500),
      company VARCHAR(255),
      website VARCHAR(500),
      industry VARCHAR(255),
      company_size VARCHAR(50),
      region VARCHAR(100),
      job_title VARCHAR(255),
      tech_stack TEXT,
      pain_points TEXT,
      scraped_data TEXT,
      status nf_lead_status NOT NULL DEFAULT 'new',
      source nf_lead_source NOT NULL DEFAULT 'manual',
      ai_insights TEXT,
      demo_url VARCHAR(500),
      demo_generated_at TIMESTAMPTZ,
      project_id UUID REFERENCES nf_projects(id) ON DELETE SET NULL,
      client_id UUID REFERENCES nf_clients(id) ON DELETE SET NULL,
      team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
      assigned_to TEXT REFERENCES nf_users(id) ON DELETE SET NULL,
      notes TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_leads status idx",  `CREATE INDEX IF NOT EXISTS nf_leads_status_idx ON nf_leads (status)`);
  await run("nf_leads team idx",    `CREATE INDEX IF NOT EXISTS nf_leads_team_idx ON nf_leads (team_id)`);
  await run("nf_leads email idx",   `CREATE INDEX IF NOT EXISTS nf_leads_email_idx ON nf_leads (email)`);
  await run("nf_leads.demo_html",   `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_html TEXT`);

  // ── nf_lead_outreach table ────────────────────────────────────────────────
  await run("nf_lead_outreach table", `
    CREATE TABLE IF NOT EXISTS nf_lead_outreach (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      channel nf_outreach_channel NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      share_link TEXT,
      sent_by TEXT REFERENCES nf_users(id) ON DELETE SET NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_lead_outreach lead idx", `CREATE INDEX IF NOT EXISTS nf_lead_outreach_lead_idx ON nf_lead_outreach (lead_id)`);

  // ── nf_notifications — add column if enum type was just created ───────────
  await run("nf_notifications.type column", `
    DO $$ BEGIN
      ALTER TABLE nf_notifications ADD COLUMN IF NOT EXISTS type nf_notification_type;
    EXCEPTION WHEN others THEN NULL; END $$;
  `);

  console.log("── Done ──────────────────────────────────────────────");
  await sql.end();
}

main().catch((err) => {
  console.error("ensure-schema fatal:", err);
  process.exit(1);
});
