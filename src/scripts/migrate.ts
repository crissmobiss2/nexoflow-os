import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });

async function run() {
  console.log("Running migration...");

  // ─── Enums ───────────────────────────────────────────────────────────────────
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_invitation_status') THEN
      CREATE TYPE nf_invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_team_role') THEN
      CREATE TYPE nf_team_role AS ENUM ('owner', 'admin', 'pm', 'developer', 'viewer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_invoice_status') THEN
      CREATE TYPE nf_invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_sprint_task_status') THEN
      CREATE TYPE nf_sprint_task_status AS ENUM ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_lead_status') THEN
      CREATE TYPE nf_lead_status AS ENUM ('new', 'contacted', 'qualified', 'demo_scheduled', 'proposal_sent', 'negotiating', 'won', 'lost', 'churned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_lead_source') THEN
      CREATE TYPE nf_lead_source AS ENUM ('manual', 'scraped', 'referral', 'inbound', 'outbound', 'imported');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nf_outreach_type') THEN
      CREATE TYPE nf_outreach_type AS ENUM ('email', 'linkedin', 'call', 'meeting', 'demo', 'proposal', 'follow_up');
    END IF;
  END $$`;
  console.log("✓ Enums done");

  // ─── Teams ───────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_teams");

  // ─── Users — add team_id ─────────────────────────────────────────────────────
  await sql`ALTER TABLE nf_users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES nf_teams(id) ON DELETE SET NULL`;
  console.log("✓ nf_users team_id");

  // Auth adapter tables not needed — using JWT-only sessions

  // ─── Team members & invitations ───────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES nf_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role nf_team_role NOT NULL DEFAULT 'developer',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(team_id, user_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS nf_team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES nf_teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role nf_team_role NOT NULL DEFAULT 'developer',
    status nf_invitation_status NOT NULL DEFAULT 'pending',
    invited_by UUID,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_team_members, nf_team_invitations");

  // ─── Add team_id to existing tables ──────────────────────────────────────────
  await sql`ALTER TABLE nf_clients ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE nf_projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE nf_knowledge_snippets ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE nf_ai_conversations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE`;
  console.log("✓ team_id added to existing tables");

  // ─── Audit logs ───────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(100),
    target_id TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_audit_logs");

  // ─── API keys ────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
    user_id TEXT,
    name VARCHAR(255) NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_api_keys");

  // ─── Sprint tasks ─────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_sprint_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES nf_projects(id) ON DELETE CASCADE,
    phase_id UUID,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    story_points INTEGER DEFAULT 1,
    status nf_sprint_task_status NOT NULL DEFAULT 'backlog',
    assignee_id TEXT,
    priority INTEGER DEFAULT 0,
    order_val INTEGER DEFAULT 0,
    due_date TIMESTAMP,
    team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS nf_sprint_tasks_project_idx ON nf_sprint_tasks(project_id)`;
  console.log("✓ nf_sprint_tasks");

  // ─── Invoices ─────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES nf_clients(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    status nf_invoice_status NOT NULL DEFAULT 'draft',
    subtotal INTEGER NOT NULL DEFAULT 0,
    tax INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMP,
    paid_date TIMESTAMP,
    notes TEXT,
    created_by TEXT,
    team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS nf_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES nf_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0
  )`;
  console.log("✓ nf_invoices, nf_invoice_line_items");

  // ─── Playbooks ────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100),
    tags TEXT[],
    team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_playbooks");

  // ─── Notifications ───────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_notifications");

  // ─── Comments ────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES nf_projects(id) ON DELETE CASCADE,
    user_id TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_comments");

  // ─── Decision log ────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_decision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES nf_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    context TEXT,
    decision TEXT NOT NULL,
    rationale TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'proposed',
    decided_by TEXT,
    decided_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_decision_logs");

  // ─── Leads ───────────────────────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS nf_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    industry VARCHAR(255),
    company_size VARCHAR(50),
    location VARCHAR(255),
    source nf_lead_source NOT NULL DEFAULT 'manual',
    status nf_lead_status NOT NULL DEFAULT 'new',
    score INTEGER DEFAULT 0,
    notes TEXT,
    scraped_data JSONB,
    demo_url VARCHAR(500),
    demo_generated_at TIMESTAMP,
    project_id UUID REFERENCES nf_projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES nf_clients(id) ON DELETE SET NULL,
    team_id UUID REFERENCES nf_teams(id) ON DELETE CASCADE,
    assigned_to TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS nf_leads_status_idx ON nf_leads(status)`;
  await sql`CREATE INDEX IF NOT EXISTS nf_leads_team_idx ON nf_leads(team_id)`;

  await sql`CREATE TABLE IF NOT EXISTS nf_lead_outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES nf_leads(id) ON DELETE CASCADE,
    type nf_outreach_type NOT NULL,
    subject VARCHAR(500),
    content TEXT,
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    replied_at TIMESTAMP,
    sent_by TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`;
  console.log("✓ nf_leads, nf_lead_outreach");

  console.log("\n✅ Migration complete!");
  await sql.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
