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

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

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

  // Backfill missing enum values for installs created with an older value set.
  // ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent.
  for (const v of ["csv_import", "manual", "api", "web_scraper"]) {
    await run(`enum nf_lead_source add ${v}`, `ALTER TYPE nf_lead_source ADD VALUE IF NOT EXISTS '${v}'`);
  }
  for (const v of ["reviewing", "demo_queued", "demo_generated", "sent", "replied", "won", "lost", "archived"]) {
    await run(`enum nf_lead_status add ${v}`, `ALTER TYPE nf_lead_status ADD VALUE IF NOT EXISTS '${v}'`);
  }

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
  await run("nf_api_keys.created_by",    `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS created_by TEXT`);
  await run("nf_api_keys.last_used_at",  `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ`);
  await run("nf_api_keys.expires_at",    `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await run("nf_api_keys.is_active",     `ALTER TABLE nf_api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);
  await run("nf_api_keys index",         `CREATE INDEX IF NOT EXISTS nf_api_keys_prefix_idx ON nf_api_keys (key_prefix)`);

  // ── Diagnostic: log nf_leads column types ────────────────────────────────
  try {
    const cols = await sql`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'nf_leads'
      ORDER BY ordinal_position
    `;
    if (cols.length > 0) {
      console.log("nf_leads existing columns:", cols.map((c: any) => `${c.column_name}:${c.udt_name}`).join(', '));
    }
  } catch (err: any) {
    console.log("diagnostic skipped:", err?.message);
  }

  // ── nf_teams (must exist before any table that references it) ─────────────
  await run("nf_teams table", `
    CREATE TABLE IF NOT EXISTS nf_teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(64) NOT NULL DEFAULT 'default',
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Backfill slug column if missing (installs created without it)
  await run("nf_teams.slug", `ALTER TABLE nf_teams ADD COLUMN IF NOT EXISTS slug VARCHAR(64) NOT NULL DEFAULT 'default'`);
  // Seed a default team for single-user installs (fallback when session has no teamId)
  await run("nf_teams default seed", `
    INSERT INTO nf_teams (id, name, slug)
    VALUES ('00000000-0000-0000-0000-000000000000', 'Default Team', 'default')
    ON CONFLICT (id) DO NOTHING
  `);
  // Drop FK constraints that reference nf_teams — single-user installs have no team rows;
  // app-level filtering still enforces multi-tenant isolation via teamId WHERE clauses.
  await run("drop nf_invoices_team_id_fkey", `ALTER TABLE nf_invoices DROP CONSTRAINT IF EXISTS nf_invoices_team_id_fkey`);
  await run("drop nf_leads_team_id_fkey",    `ALTER TABLE nf_leads DROP CONSTRAINT IF EXISTS nf_leads_team_id_fkey`);
  await run("drop nf_clients_team_id_fkey",  `ALTER TABLE nf_clients DROP CONSTRAINT IF EXISTS nf_clients_team_id_fkey`);

  // ── nf_leads: drop & recreate if table is empty and has legacy schema ──────
  // Safe because all insert attempts have been failing (no leads exist).
  // Triggers on: wrong status type OR presence of old company_name column (NOT NULL, no default)
  await run("nf_leads safety recreate", `
    DO $$
    DECLARE row_count INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='nf_leads') THEN
        SELECT COUNT(*) INTO row_count FROM nf_leads;
        IF row_count = 0 THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='nf_leads'
              AND column_name='status' AND udt_name='nf_lead_status'
          ) OR EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='nf_leads'
              AND column_name='company_name'
          ) THEN
            DROP TABLE IF EXISTS nf_affiliate_referrals;
            DROP TABLE IF EXISTS nf_lead_outreach;
            DROP TABLE IF EXISTS nf_lead_calls;
            DROP TABLE IF EXISTS nf_leads;
            RAISE NOTICE 'Dropped nf_leads (empty table with legacy schema) for clean recreation';
          END IF;
        END IF;
      END IF;
    END $$;
  `);

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
      assigned_to TEXT,
      notes TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_leads status idx",  `CREATE INDEX IF NOT EXISTS nf_leads_status_idx ON nf_leads (status)`);
  await run("nf_leads team idx",    `CREATE INDEX IF NOT EXISTS nf_leads_team_idx ON nf_leads (team_id)`);
  await run("nf_leads email idx",   `CREATE INDEX IF NOT EXISTS nf_leads_email_idx ON nf_leads (email)`);
  // Patch columns that may be missing if table was created by an older schema version
  await run("nf_leads.email",           `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
  await run("nf_leads.first_name",      `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
  await run("nf_leads.last_name",       `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`);
  await run("nf_leads.phone",           `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
  await run("nf_leads.linkedin",        `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS linkedin VARCHAR(500)`);
  await run("nf_leads.company",         `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS company VARCHAR(255)`);
  await run("nf_leads.website",         `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS website VARCHAR(500)`);
  await run("nf_leads.industry",        `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS industry VARCHAR(255)`);
  await run("nf_leads.company_size",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS company_size VARCHAR(50)`);
  await run("nf_leads.region",          `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS region VARCHAR(100)`);
  await run("nf_leads.job_title",       `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS job_title VARCHAR(255)`);
  await run("nf_leads.tech_stack",      `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS tech_stack TEXT`);
  await run("nf_leads.pain_points",     `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS pain_points TEXT`);
  await run("nf_leads.scraped_data",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS scraped_data TEXT`);
  // Fix: scraped_data was created as JSONB by old drizzle-kit; Drizzle schema expects TEXT
  await run("nf_leads.scraped_data jsonb->text", `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='nf_leads'
          AND column_name='scraped_data' AND udt_name='jsonb'
      ) THEN
        ALTER TABLE nf_leads ALTER COLUMN scraped_data TYPE TEXT USING scraped_data::text;
        RAISE NOTICE 'Converted scraped_data from JSONB to TEXT';
      END IF;
    END $$;
  `);
  await run("nf_leads.ai_insights",     `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS ai_insights TEXT`);
  await run("nf_leads.demo_url",        `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_url VARCHAR(500)`);
  await run("nf_leads.demo_generated_at", `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_generated_at TIMESTAMPTZ`);
  await run("nf_leads.demo_html",       `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_html TEXT`);
  await run("nf_leads.proposal_html",   `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS proposal_html TEXT`);
  await run("nf_leads.proposal_url",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS proposal_url VARCHAR(500)`);
  await run("nf_leads.project_id",      `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES nf_projects(id) ON DELETE SET NULL`);
  await run("nf_leads.client_id",       `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES nf_clients(id) ON DELETE SET NULL`);
  await run("nf_leads.team_id",         `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE`);
  await run("nf_leads.assigned_to",     `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS assigned_to TEXT`);
  await run("nf_leads.notes",           `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS notes TEXT`);
  await run("nf_leads.tags",            `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS tags TEXT[]`);

  // ── nf_invoices — add milestone linking columns ────────────────────────────
  await run("nf_invoices.project_id",    `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES nf_projects(id) ON DELETE SET NULL`);
  await run("nf_invoices.milestone_step",`ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS milestone_step INTEGER`);
  await run("nf_invoices project idx",   `CREATE INDEX IF NOT EXISTS nf_invoices_project_idx ON nf_invoices (project_id)`);

  // ── nf_lead_outreach table ────────────────────────────────────────────────
  await run("nf_lead_outreach table", `
    CREATE TABLE IF NOT EXISTS nf_lead_outreach (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      channel nf_outreach_channel NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      share_link TEXT,
      sent_by TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_lead_outreach lead idx", `CREATE INDEX IF NOT EXISTS nf_lead_outreach_lead_idx ON nf_lead_outreach (lead_id)`);

  // ── nf_notifications — add type column (IF NOT EXISTS avoids duplicate_column error)
  await run("nf_notifications.type column", `ALTER TABLE nf_notifications ADD COLUMN IF NOT EXISTS type nf_notification_type`);

  // ── nf_lead_outreach — new columns ───────────────────────────────────────
  await run("nf_lead_outreach.opened_at",  `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ`);
  await run("nf_lead_outreach.clicked_at", `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ`);
  await run("nf_lead_outreach.replied_at", `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ`);
  await run("nf_lead_outreach.subject",    `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS subject VARCHAR(500)`);
  await run("nf_lead_outreach.share_link", `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS share_link VARCHAR(500)`);
  await run("nf_lead_outreach.created_at", `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  // ── nf_leads — new columns ────────────────────────────────────────────────
  await run("nf_leads.source_detail",  `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS source_detail VARCHAR(255)`);
  await run("nf_leads.affiliate_code", `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(32)`);
  await run("nf_leads.booking_ref",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS booking_ref VARCHAR(255)`);

  // ── nf_invoices — Stripe columns ──────────────────────────────────────────
  await run("nf_invoices.stripe_payment_url",     `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS stripe_payment_url VARCHAR(1000)`);
  await run("nf_invoices.stripe_payment_link_id", `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id VARCHAR(255)`);

  // ── nf_affiliates — enums and table ──────────────────────────────────────
  await run("enum nf_affiliate_status", `
    DO $$ BEGIN
      CREATE TYPE nf_affiliate_status AS ENUM ('pending','approved','rejected','suspended');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await run("enum nf_affiliate_tier", `
    DO $$ BEGIN
      CREATE TYPE nf_affiliate_tier AS ENUM ('base','silver','gold');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await run("nf_affiliates table", `
    CREATE TABLE IF NOT EXISTS nf_affiliates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      website VARCHAR(500),
      promo_method VARCHAR(100),
      status nf_affiliate_status NOT NULL DEFAULT 'pending',
      tier nf_affiliate_tier NOT NULL DEFAULT 'base',
      referral_code VARCHAR(32) NOT NULL UNIQUE,
      paypal_email VARCHAR(255),
      total_referrals INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      paid_out_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_affiliates_email_idx", `CREATE INDEX IF NOT EXISTS nf_affiliates_email_idx ON nf_affiliates (email)`);
  await run("nf_affiliates_code_idx",  `CREATE INDEX IF NOT EXISTS nf_affiliates_code_idx ON nf_affiliates (referral_code)`);

  await run("enum nf_affiliate_referral_status", `
    DO $$ BEGIN
      CREATE TYPE nf_affiliate_referral_status AS ENUM ('pending','converted','paid','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await run("nf_affiliate_referrals table", `
    CREATE TABLE IF NOT EXISTS nf_affiliate_referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      affiliate_id UUID NOT NULL REFERENCES nf_affiliates(id) ON DELETE CASCADE,
      lead_id UUID REFERENCES nf_leads(id) ON DELETE SET NULL,
      project_id UUID REFERENCES nf_projects(id) ON DELETE SET NULL,
      status nf_affiliate_referral_status NOT NULL DEFAULT 'pending',
      commission_pct INTEGER NOT NULL DEFAULT 10,
      project_value_cents INTEGER DEFAULT 0,
      commission_cents INTEGER DEFAULT 0,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_affiliate_refs_affiliate_idx", `CREATE INDEX IF NOT EXISTS nf_affiliate_refs_affiliate_idx ON nf_affiliate_referrals (affiliate_id)`);

  // ── nf_case_studies ───────────────────────────────────────────────────────
  await run("nf_case_studies table", `
    CREATE TABLE IF NOT EXISTS nf_case_studies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_name VARCHAR(255) NOT NULL,
      client_title VARCHAR(255),
      client_company VARCHAR(255),
      client_industry VARCHAR(255),
      avatar_initials VARCHAR(4),
      testimonial TEXT NOT NULL,
      metric1_label VARCHAR(100),
      metric1_value VARCHAR(50),
      metric2_label VARCHAR(100),
      metric2_value VARCHAR(50),
      metric3_label VARCHAR(100),
      metric3_value VARCHAR(50),
      published BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      linked_project_id UUID REFERENCES nf_projects(id) ON DELETE SET NULL,
      linked_client_id UUID REFERENCES nf_clients(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_case_studies_published_idx", `CREATE INDEX IF NOT EXISTS nf_case_studies_published_idx ON nf_case_studies (published)`);

  // ── nf_lead_calls ─────────────────────────────────────────────────────────
  await run("enum nf_call_outcome", `
    DO $$ BEGIN
      CREATE TYPE nf_call_outcome AS ENUM ('no_show','won','lost','follow_up','not_interested','rescheduled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await run("nf_lead_calls table", `
    CREATE TABLE IF NOT EXISTS nf_lead_calls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      outcome nf_call_outcome,
      notes TEXT,
      called_by TEXT,
      booking_ref VARCHAR(255),
      duration_minutes INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_lead_calls_lead_idx", `CREATE INDEX IF NOT EXISTS nf_lead_calls_lead_idx ON nf_lead_calls (lead_id)`);

  // ── nf_notifications — add link column ───────────────────────────────────
  await run("nf_notifications.link column", `ALTER TABLE nf_notifications ADD COLUMN IF NOT EXISTS link TEXT`);

  // ── nf_invoice_line_items — add missing columns ──────────────────────────
  await run("nf_invoice_line_items.rate column", `ALTER TABLE nf_invoice_line_items ADD COLUMN IF NOT EXISTS rate INTEGER NOT NULL DEFAULT 0`);
  await run("nf_invoice_line_items.amount column", `ALTER TABLE nf_invoice_line_items ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0`);
  await run("nf_invoice_line_items.created_at column", `ALTER TABLE nf_invoice_line_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
  await run("nf_invoice_line_items.updated_at column", `ALTER TABLE nf_invoice_line_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

  // ── nf_invoices — multi-currency + recurring columns ─────────────────────
  await run("nf_invoices.currency", `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'GBP'`);
  await run("nf_invoices.recurring_interval", `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS recurring_interval VARCHAR(20)`);
  await run("nf_invoices.recurring_enabled", `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS recurring_enabled BOOLEAN NOT NULL DEFAULT false`);
  await run("nf_invoices.next_recurring_at", `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS next_recurring_at TIMESTAMPTZ`);
  await run("nf_invoices.stripe_customer_id", `ALTER TABLE nf_invoices ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`);

  // ── nf_leads — AI score + enrichment columns ──────────────────────────────
  await run("nf_leads.ai_score", `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS ai_score INTEGER`);
  await run("nf_leads.ai_score_reason", `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS ai_score_reason TEXT`);
  await run("nf_leads.enriched_at", `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ`);

  // ── nf_leads — scrape + business profile + demo tracking + share token ────
  await run("nf_leads.scraped_profile",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS scraped_profile JSONB`);
  await run("nf_leads.scraped_at",         `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ`);
  await run("nf_leads.business_profile",   `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS business_profile JSONB`);
  await run("nf_leads.business_profile_at",`ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS business_profile_at TIMESTAMPTZ`);
  await run("nf_leads.demo_blob_url",      `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_blob_url VARCHAR(1000)`);
  await run("nf_leads.demo_view_count",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_view_count INTEGER NOT NULL DEFAULT 0`);
  await run("nf_leads.demo_last_viewed_at",`ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_last_viewed_at TIMESTAMPTZ`);
  await run("nf_leads.demo_total_seconds", `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS demo_total_seconds INTEGER NOT NULL DEFAULT 0`);
  await run("nf_leads.share_token",        `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)`);
  await run("nf_leads.share_revoked_at",   `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ`);
  await run("nf_leads.proposal_blob_url",  `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS proposal_blob_url VARCHAR(1000)`);
  await run("nf_leads.industry_profile_id",`ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS industry_profile_id UUID`);
  await run("nf_leads.won_value_cents",    `ALTER TABLE nf_leads ADD COLUMN IF NOT EXISTS won_value_cents INTEGER`);
  await run("nf_leads_share_token_idx",    `CREATE INDEX IF NOT EXISTS nf_leads_share_token_idx ON nf_leads (share_token)`);

  // ── nf_lead_outreach — provider id columns for Resend matching ────────────
  await run("nf_lead_outreach.provider_message_id", `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255)`);
  await run("nf_lead_outreach.provider_status",     `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS provider_status VARCHAR(64)`);
  await run("nf_lead_outreach.provider_error",      `ALTER TABLE nf_lead_outreach ADD COLUMN IF NOT EXISTS provider_error TEXT`);
  await run("nf_lead_outreach_provider_id_idx",     `CREATE INDEX IF NOT EXISTS nf_lead_outreach_provider_id_idx ON nf_lead_outreach (provider_message_id)`);

  // ── nf_lead_demo_views ───────────────────────────────────────────────────
  await run("nf_lead_demo_views table", `
    CREATE TABLE IF NOT EXISTS nf_lead_demo_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      session_id VARCHAR(64) NOT NULL,
      referrer VARCHAR(500),
      user_agent TEXT,
      ip_hash VARCHAR(64),
      seconds_on_page INTEGER NOT NULL DEFAULT 0,
      scroll_depth_pct INTEGER NOT NULL DEFAULT 0,
      cta_clicks INTEGER NOT NULL DEFAULT 0,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_lead_demo_views_lead_idx",    `CREATE INDEX IF NOT EXISTS nf_lead_demo_views_lead_idx ON nf_lead_demo_views (lead_id)`);
  await run("nf_lead_demo_views_session_idx", `CREATE INDEX IF NOT EXISTS nf_lead_demo_views_session_idx ON nf_lead_demo_views (session_id)`);

  // ── nf_industry_profiles ─────────────────────────────────────────────────
  await run("nf_industry_profiles table", `
    CREATE TABLE IF NOT EXISTS nf_industry_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(64) NOT NULL UNIQUE,
      industry VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      common_pain_points JSONB,
      typical_offers JSONB,
      demo_angle TEXT,
      proposal_angle TEXT,
      suggested_features JSONB,
      brand_palette JSONB,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_industry_profiles_industry_idx", `CREATE INDEX IF NOT EXISTS nf_industry_profiles_industry_idx ON nf_industry_profiles (industry)`);

  // Seed core industry profiles (idempotent via ON CONFLICT)
  await run("seed industry profiles", `
    INSERT INTO nf_industry_profiles (slug, industry, display_name, description, common_pain_points, typical_offers, demo_angle, suggested_features, brand_palette)
    VALUES
      ('hvac', 'HVAC', 'HVAC / Plumbing Services',
        'Local trade businesses doing repairs, installs, maintenance contracts',
        '["No online booking","No SEO traffic","Manual quotes via phone","No service-area routing","Lose calls after hours"]'::jsonb,
        '["24/7 emergency callouts","Maintenance plans","Install + repair","Free quotes"]'::jsonb,
        'Show them a sleek booking flow with same-day availability, instant text-back, and a service-area map. Lead with "stop losing after-hours calls".',
        '["Online booking with same-day slots","Instant SMS quote","Service area map","Reviews carousel","Click-to-call sticky bar"]'::jsonb,
        '["#0a4d8c","#f59e0b","#0f172a"]'::jsonb),
      ('dental', 'Dental', 'Dental Practice',
        'Solo and group dental practices targeting new patient acquisition',
        '["Outdated website","No online booking","Insurance questions answered manually","No new-patient nurture flow","Hard to find pricing"]'::jsonb,
        '["General + cosmetic","New patient specials","Invisalign / implants","Family plans"]'::jsonb,
        'A warm, trust-building site with online booking, transparent pricing, before/after gallery, and an insurance helper. Lead with "more new patients on autopilot".',
        '["Online booking","Insurance verification widget","Treatment gallery","Patient reviews","SMS reminders"]'::jsonb,
        '["#0ea5e9","#f0f9ff","#0c4a6e"]'::jsonb),
      ('law', 'Legal', 'Law Firm',
        'Solo and boutique law firms — personal injury, family, business, immigration',
        '["Generic template site","No live chat","Slow case intake","No clear practice area pages","Compliance constraints on copy"]'::jsonb,
        '["Free consultation","No win no fee","Practice-area expertise","Multi-language support"]'::jsonb,
        'An authoritative, conversion-focused site with practice-area landing pages, instant intake form with smart routing, and case-result proof. Lead with "qualified leads, not tire kickers".',
        '["Smart intake form","Practice-area pages","Case result highlights","Free consult booking","Bilingual support"]'::jsonb,
        '["#1e3a8a","#b45309","#0f172a"]'::jsonb),
      ('restaurant', 'Restaurant', 'Restaurant / Hospitality',
        'Independent restaurants and small chains',
        '["Outdated menu","No online ordering","High commission delivery apps","No reservations system","Slow on mobile"]'::jsonb,
        '["Dine in / takeout","Online ordering","Catering","Private events"]'::jsonb,
        'A mouth-watering site with photo-led menu, direct online ordering (skip the 30% delivery fees), reservations, and a loyalty hook. Lead with "keep more of every order".',
        '["Direct online ordering","Reservations","Loyalty / SMS list","Photo-led menu","Mobile-first hero"]'::jsonb,
        '["#dc2626","#fef3c7","#7c2d12"]'::jsonb),
      ('ecommerce', 'E-commerce', 'E-commerce / DTC Brand',
        'Direct-to-consumer brands on Shopify, WooCommerce, or custom',
        '["Slow LCP","High cart abandonment","No upsell flow","Generic product pages","Weak email automation"]'::jsonb,
        '["Premium product line","Subscription / refills","Bundles","Free shipping threshold"]'::jsonb,
        'A fast, brand-matched storefront with subscription, bundle builder, post-purchase upsell, and email/SMS automation. Lead with "AOV up, CAC down".',
        '["Bundle builder","Subscription billing","Post-purchase upsell","Email + SMS flows","Speed-optimized PDPs"]'::jsonb,
        '["#0f172a","#f8fafc","#a855f7"]'::jsonb),
      ('saas', 'SaaS', 'B2B SaaS',
        'Early-stage to scaling B2B software companies',
        '["Generic homepage","No persona-targeted pages","Long onboarding","No usage analytics on marketing","Weak self-serve trial"]'::jsonb,
        '["Free trial","Per-seat pricing","Enterprise tier","Integrations marketplace"]'::jsonb,
        'A product-led marketing site with interactive demo, persona pages, transparent pricing, and integration showcase. Lead with "more trials, faster activation".',
        '["Interactive product demo","Persona landing pages","Self-serve trial","Integrations directory","ROI calculator"]'::jsonb,
        '["#2563eb","#7c3aed","#0f172a"]'::jsonb)
    ON CONFLICT (slug) DO NOTHING
  `);

  // ── nf_outreach_templates ────────────────────────────────────────────────
  await run("nf_outreach_templates table", `
    CREATE TABLE IF NOT EXISTS nf_outreach_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      channel nf_outreach_channel NOT NULL,
      subject VARCHAR(500),
      body TEXT NOT NULL,
      tags TEXT[],
      industry VARCHAR(255),
      use_count INTEGER NOT NULL DEFAULT 0,
      won_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      owner_id TEXT,
      team_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_outreach_templates_channel_idx",  `CREATE INDEX IF NOT EXISTS nf_outreach_templates_channel_idx ON nf_outreach_templates (channel)`);
  await run("nf_outreach_templates_industry_idx", `CREATE INDEX IF NOT EXISTS nf_outreach_templates_industry_idx ON nf_outreach_templates (industry)`);

  // ── nf_lead_outcomes ─────────────────────────────────────────────────────
  await run("nf_lead_outcomes table", `
    CREATE TABLE IF NOT EXISTS nf_lead_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      outcome VARCHAR(32) NOT NULL,
      value_cents INTEGER,
      notes TEXT,
      industry_profile_id UUID,
      demo_style_tag VARCHAR(64),
      captured_by TEXT,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_lead_outcomes_lead_idx",    `CREATE INDEX IF NOT EXISTS nf_lead_outcomes_lead_idx ON nf_lead_outcomes (lead_id)`);
  await run("nf_lead_outcomes_outcome_idx", `CREATE INDEX IF NOT EXISTS nf_lead_outcomes_outcome_idx ON nf_lead_outcomes (outcome)`);

  // ── nf_clients — portal columns ───────────────────────────────────────────
  await run("nf_clients.portal_token", `ALTER TABLE nf_clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE`);
  await run("nf_clients.portal_enabled", `ALTER TABLE nf_clients ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN NOT NULL DEFAULT false`);
  await run("nf_clients.slack_webhook_url", `ALTER TABLE nf_clients ADD COLUMN IF NOT EXISTS slack_webhook_url VARCHAR(500)`);

  // ── nf_proposal_versions ──────────────────────────────────────────────────
  await run("nf_proposal_versions table", `
    CREATE TABLE IF NOT EXISTS nf_proposal_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      html TEXT NOT NULL,
      signed_at TIMESTAMPTZ,
      signer_name VARCHAR(255),
      signer_email VARCHAR(255),
      signer_ip VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_proposal_versions_lead_idx", `CREATE INDEX IF NOT EXISTS nf_proposal_versions_lead_idx ON nf_proposal_versions (lead_id)`);

  // ── nf_follow_up_sequences ────────────────────────────────────────────────
  await run("nf_followup_status enum", `DO $$ BEGIN CREATE TYPE nf_followup_status AS ENUM ('active','paused','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await run("nf_follow_up_sequences table", `
    CREATE TABLE IF NOT EXISTS nf_follow_up_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL DEFAULT 'Default Sequence',
      status nf_followup_status NOT NULL DEFAULT 'active',
      current_step INTEGER NOT NULL DEFAULT 0,
      total_steps INTEGER NOT NULL DEFAULT 3,
      next_send_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await run("nf_followup_lead_idx", `CREATE INDEX IF NOT EXISTS nf_followup_lead_idx ON nf_follow_up_sequences (lead_id)`);

  console.log("── Done ──────────────────────────────────────────────");
  await sql.end();
}

main().catch((err) => {
  console.error("ensure-schema fatal:", err);
  process.exit(1);
});
